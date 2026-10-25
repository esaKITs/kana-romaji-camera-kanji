# Evaluation data and reference notices

The evaluation sentences were authored for this project. Gold readings were reviewed linguistically and cross-checked against an independent lexicon; they are not generated from the evaluated analyzers.

The lexical cross-check uses JMdict © Jim Breen and the Electronic Dictionary Research and Development Group (EDRDG), under Creative Commons Attribution-ShareAlike 4.0. The evaluation data and lexical-check records are supplied under CC BY-SA 4.0; this notice does not relicense application source code. Changes include selecting spellings/readings, recording verification results, and constructing new sentences.

- Project: https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
- License statement and documentation: https://www.edrdg.org/edrdg/licence.html
- CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
- Source checksum: `results/v2-gold-lexical-check.json`.

No JMdict binary, glosses or corpus sentences are bundled in the running prototype. JMdict is used for evaluation validation only. Refresh the check before reusing a later benchmark version; the cross-check is a dated measurement, not a dictionary application.

The Japan Foundation's Marugoto number tables were consulted for basic 本/冊/人 counting forms. The new sentences are not copied from the textbook, and no textbook pages are redistributed.

- https://marugoto.jpf.go.jp/assets/docs/download/starter_a/MarugotoStarterWordbook_EN.pdf
- Additional linguistic counter review is documented explicitly, without claiming an external full-headword match for every inflected/counter phrase.

The optional local fixture generator uses Noto Sans JP (SIL Open Font License 1.1), copyright notice in NotoSansJP-OFL.txt. Generated PNGs are rendered test sentences, not photographs or scans supplied by a user.

The separated Sudachi wrapper declares Apache-2.0 in Cargo.toml and its source headers. The Rust engine retains its own Apache-2.0 license. Dictionary `SudachiDict-small 20250129` carries Apache-2.0 and UniDic-derived attribution requirements; retain the dictionary LEGAL/UniDic notices when packaging a future release. See the existing Sudachi/UniDic notices in this directory. Production redistribution is not approved by this research build.
