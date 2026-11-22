// cspell:ignore onopentag ontext onclosetag
import { Parser } from "htmlparser2";

/** Extract plain role text, never HTML to insert into a page. Decode entities
 * once in the parser and omit non-visible raw-text/template content. */
export function htmlText(source: string): string {
  const parts: string[] = [];
  const hidden = new Set(["script", "style", "template"]);
  let hiddenDepth = 0;
  const parser = new Parser(
    {
      onopentag(name) {
        if (hiddenDepth > 0 || hidden.has(name)) hiddenDepth += 1;
        else parts.push(" ");
      },
      ontext(value) {
        if (hiddenDepth === 0) parts.push(value);
      },
      onclosetag() {
        if (hiddenDepth > 0) hiddenDepth -= 1;
        else parts.push(" ");
      },
    },
    { decodeEntities: true, xmlMode: false },
  );
  parser.end(source);
  return parts.join("").replace(/\s+/gu, " ").normalize("NFC").trim();
}
