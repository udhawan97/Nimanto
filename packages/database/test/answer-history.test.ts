import { PGlite } from "@electric-sql/pglite";
import { afterEach, expect, it, vi } from "vitest";
import { NimantoStore } from "../src/store.js";

const stores: NimantoStore[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

const input = {
  topic: "custom" as const,
  prompt: "Synthetic prompt",
  answerText: "First synthetic answer",
};

it("keeps the history header and rows coherent when a save starts between reads", async () => {
  const store = await NimantoStore.open("memory://answer-history-race");
  stores.push(store);
  const owner = await store.createLocalTenant("history-race@example.test", "History");
  const answer = await store.saveAnswerBlock(owner.tenantId, input);
  const reached = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const writerStarted = Promise.withResolvers<void>();
  let waitingForWriter = false;
  let gated = false;
  async function afterHeader(sql: string) {
    if (!gated && sql.includes("SELECT id, current_revision FROM answer_blocks")) {
      gated = true;
      reached.resolve();
      await resume.promise;
    }
  }
  // Gate the real query result at both database seams. Transactional queries
  // bypass PGlite.query, so wrap their query method without changing locking.
  const query = PGlite.prototype.query;
  vi.spyOn(PGlite.prototype, "query").mockImplementation(async function (
    this: PGlite,
    sql,
    ...args
  ) {
    const result = await query.call(this, sql, ...args);
    await afterHeader(sql);
    return result;
  });
  const transaction = PGlite.prototype.transaction;
  vi.spyOn(PGlite.prototype, "transaction").mockImplementation(function (this: PGlite, work) {
    const result = transaction.call(this, async (tx) => {
      const transactionQuery = tx.query.bind(tx);
      vi.spyOn(tx, "query").mockImplementation(async (sql, ...args) => {
        const value = await transactionQuery(sql, ...args);
        await afterHeader(sql);
        return value;
      });
      return work(tx);
    });
    if (waitingForWriter) writerStarted.resolve();
    return result;
  });

  const read = store.listAnswerRevisions(owner.tenantId, answer.id, { limit: 1 });
  await reached.promise;
  waitingForWriter = true;
  const write = store.saveAnswerBlock(owner.tenantId, {
    ...input,
    id: answer.id,
    answerText: "Second synthetic answer",
  });
  // The writer has entered PGlite's transaction queue before the next history
  // read starts. Do not wait for its commit while holding a read transaction.
  await writerStarted.promise;
  resume.resolve();
  const [page, saved] = await Promise.all([read, write]);
  expect(gated).toBe(true);
  expect(page.currentRevision).toBe(1);
  expect(page.revisions.map(({ revision }) => revision)).toEqual([1]);
  expect(page.nextCursor).toBeNull();
  expect(saved.currentRevision).toBe(2);
  const latest = await store.listAnswerRevisions(owner.tenantId, answer.id, { limit: 1 });
  expect(latest.currentRevision).toBe(2);
  expect(latest.revisions.map(({ revision }) => revision)).toEqual([2]);
  const older = await store.listAnswerRevisions(owner.tenantId, answer.id, {
    cursor: latest.nextCursor!,
  });
  expect(older.currentRevision).toBe(2);
  expect(older.revisions.map(({ revision }) => revision)).toEqual([1]);
});

it("preserves pagination, cursor ownership, and nested snapshot reads", async () => {
  const store = await NimantoStore.open("memory://answer-history-cursors");
  stores.push(store);
  const owner = await store.createLocalTenant("history-owner@example.test", "Owner");
  const foreign = await store.createLocalTenant("history-foreign@example.test", "Foreign");
  const answer = await store.saveAnswerBlock(owner.tenantId, input);
  await store.saveAnswerBlock(owner.tenantId, { ...input, id: answer.id, answerText: "Second" });
  await store.saveAnswerBlock(owner.tenantId, { ...input, id: answer.id, answerText: "Third" });
  const otherAnswer = await store.saveAnswerBlock(owner.tenantId, input);
  const foreignAnswer = await store.saveAnswerBlock(foreign.tenantId, input);

  const pages = await store.readSnapshot(async (snapshot) => {
    const first = await snapshot.listAnswerRevisions(owner.tenantId, answer.id, { limit: 1 });
    const second = await snapshot.listAnswerRevisions(owner.tenantId, answer.id, {
      limit: 1,
      cursor: first.nextCursor!,
    });
    const third = await snapshot.listAnswerRevisions(owner.tenantId, answer.id, {
      limit: 1,
      cursor: second.nextCursor!,
    });
    return [first, second, third];
  });
  expect(pages.map(({ currentRevision }) => currentRevision)).toEqual([3, 3, 3]);
  expect(pages.flatMap(({ revisions }) => revisions.map(({ revision }) => revision))).toEqual([
    3, 2, 1,
  ]);
  expect(pages.at(-1)!.nextCursor).toBeNull();
  for (const cursor of ["missing", otherAnswer.latest.id, foreignAnswer.latest.id]) {
    await expect(store.listAnswerRevisions(owner.tenantId, answer.id, { cursor })).rejects.toThrow(
      "INVALID_CURSOR",
    );
  }
  await expect(store.listAnswerRevisions(foreign.tenantId, answer.id)).rejects.toThrow(
    "ANSWER_BLOCK_NOT_FOUND",
  );
  expect((await store.listAnswerRevisions(owner.tenantId, answer.id)).revisions).toHaveLength(3);
});
