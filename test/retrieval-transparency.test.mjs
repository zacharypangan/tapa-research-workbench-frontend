import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Use the project's existing compiler to exercise the same TSX helpers as the UI.
const source = readFileSync(new URL('../src/components/repository/formatters.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
const exports = {};
runInNewContext(compiled.outputText, { exports, require: createRequire(import.meta.url) });
const { getRetrievalLabel, getRetrievalReason, getSemanticScore, imageEvidenceText } = exports;

test('offline exact matches never present the rank sentinel as embedding certainty', () => {
  const exact = { content_text: 'Orchard evidence', score: 1, semantic_score: null, retrieval_method: 'exact_text' };
  assert.equal(getRetrievalLabel(exact), 'Exact text match');
  assert.equal(getSemanticScore(exact), undefined);
  assert.doesNotMatch(getRetrievalReason(exact, ['orchard']), /ranked by embedding|100/);
  assert.equal(getRetrievalLabel({ score: 1, semantic_score: null }), 'Exact text match');
});

test('embedding labels preserve raw similarity, including zero and negative values', () => {
  for (const score of [0, -0.125, 0.842, 1]) {
    const evidence = { content_text: 'Orchard evidence', score, semantic_score: score, retrieval_method: 'embedding_similarity' };
    assert.equal(getRetrievalLabel(evidence), `Embedding similarity ${score.toFixed(3)}`);
    assert.equal(getSemanticScore(evidence), score);
  }
  assert.equal(getRetrievalLabel({ score: 1 }), 'Retrieved evidence');
  assert.equal(getSemanticScore({ semantic_score: NaN }), undefined);
});

test('image text preserves the distinction between OCR and AI descriptions in observations and exports', () => {
  const text = imageEvidenceText({ ocr_text: 'Original wording', visual_caption: 'Possible tool' });
  assert.match(text, /^OCR text:\nOriginal wording/);
  assert.match(text, /AI image description:\nPossible tool/);
  assert.equal(imageEvidenceText({}), '');
});
