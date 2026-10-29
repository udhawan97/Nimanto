# Packet PDF fonts

These static Noto fonts ship with the API and worker. PDFs embed only the
glyphs each Packet uses. Runtime rendering does not consult system fonts or the
network. The adjacent OFL files must accompany redistributed font files.

| File                           | Upstream Google Fonts git blob             | SHA-256                                                            |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| NotoSans-Regular.ttf           | `75575046c015ff623a848096a15779867ba71453` | `bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d` |
| NotoSansDevanagari-Regular.ttf | `163f04bddc5a96fc523e4080466cac5c588f6594` | `14ec4af41f27482216d1c2229f417ff9b1425e1babb014e57d1d40d03229853e` |
| NotoSansSC-Regular.ttf         | `fb0637bafbcd804fe32152370a1225990745b4bc` | `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da` |

Sources: [Noto Sans](https://github.com/google/fonts/tree/main/ofl/notosans),
[Noto Sans Devanagari](https://github.com/google/fonts/tree/main/ofl/notosansdevanagari),
[Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc).

The table hashes identify the upstream variable font inputs. Static files were
derived with fontTools 4.63.0 at `wght=400`, `wdth=100` where available, with
`recalcTimestamp=False`. [derivation.json](derivation.json) records the shipped
output hashes. Reproduce with `TTFont(input, recalcTimestamp=False)`,
`instantiateVariableFont(font, axes, inplace=False)`, set the result's
`recalcTimestamp=False`, set the result's `glyf` table `padding=2`, and save it.
This two-byte glyph alignment is required by fontkit's subsetter when it emits
short glyph offsets. Unpadded inputs can lose visible glyphs while text
extraction still passes. The document tests decode every embedded glyph outline
to guard against that failure. Variable fonts must not replace the static assets.

## Supported text and extraction

Packet PDFs support the actual glyph coverage of these fonts, including Latin,
Greek, Cyrillic, Devanagari and CJK text. A grapheme must be completely covered
by one bundled font; shaping runs preserve that font's OpenType glyph order,
advances and mark offsets. Missing glyphs, format controls and non-whitespace
control characters cause `PACKET_TEXT_UNSUPPORTED` before any artifacts are
written. This is a non-destructive refusal: saved Evidence Claims, Profile
Versions and Application state remain available. Emoji and additional scripts
need a reviewed font/shaping addition before Packet rendering supports them.

Width-based wrapping uses grapheme boundaries for long words and CJK text.
Each word's exact original Unicode wording is split at grapheme boundaries into
chunks of at most 32 UTF-16 code units. The chunks populate successive glyph
ToUnicode mappings and `ActualText` spans, including across physical line
fragments. Every ToUnicode destination stays within PDF 32000-1's 512-byte
limit; the smaller 64-byte compatibility cap also avoids Poppler rejecting long
destinations. ActualText groups adjacent glyphs into spans of at most 16,386 bytes
including their UTF-16 byte order mark. An indivisible grapheme exceeding 32
code units refuses cleanly.

Chunks containing combining marks use an empty glyph outline at the current pen
position: PDF.js treats such mappings as zero-width text. The actual shaped
glyphs retain their original positions. Other shaping-only glyphs map to a
format mark. This retains source wording in extractors that ignore ActualText
and prevents Devanagari vowel/reph reordering from changing extracted text.
Search and selection operate at word or bounded-chunk granularity. Canonical
JSON, plain text, DOCX wording and Packet v2 content hashes are unchanged.

DOCX files retain Unicode text and their existing font hints. Their exact
display remains dependent on the document viewer's installed fonts.
