# v0.2.19 — additive number/counter pronunciation

The existing Kuromoji dictionary remains the general reading engine. Open
JTalk 1.11 rule tables are added after dictionary analysis. The tables and
BSD notice are pinned and archived; no OCR model, canonical function,
threshold, tile resolution or raw recognition output is changed.

30 pronunciation examples in `tests/fixtures/counter-readings.json` are
tested in kanji numerals, ASCII digits and fullwidth digits (90 inputs),
including 歳/本/人/日間/枚/個/回/匹/杯/時/分/箱/台/泊/羽/冊/階/円/年/
週間/ヶ月/件/軒/着/通. Complete PP region labels are checked in all three
reading modes (270 label assertions). The real browser worker is also
checked for all 90 inputs under both OCR engine modes by the existing
numeric browser integration test. Ruby/name/invalid-number safeguards and
unmodified source strings/offsets have regression assertions.

Worker and changed numeric module URLs are versioned to prevent old cached
reading code from being paired with the new camera bundle. The original
five-line sample and Practice A image remain unchanged and are separately
tested through actual OCR, modes, Still and synthetic Live.

## Limits kept separate from reading success

The additional 30-row image (`counter-variants.png`) is an OCR evaluation
input, not a pronunciation-only test. In the first Meiki run, 23/30 rows
rendered all three variants correctly. Other rows had missing detections or
OCR errors such as 8冊→8円, 3羽→329 and 1軒→軒. These are NOT counted as
successful original-image conversions just because the reading worker
passes 90/90 correct text inputs. The OCR model is unchanged in this release.

The iPhone failure to apply crop verification to 二十日間 remains unresolved;
Linux Chromium success does not establish physical iPhone success. Rotation,
vertical text, label size policy, PDF input/output and final ei/ee/nasal
spelling policy remain separate pending work.

The local full unit run has 135 passes and one missing research Sudachi
asset failure. The required complete suite is checked in GitHub Actions,
which builds those pinned research assets; no test is disabled or skipped.
