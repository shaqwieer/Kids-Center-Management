import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../src/whatsapp/templates.js';

test('normalizePhone turns a local Saudi number into E.164 digits', () => {
  assert.equal(normalizePhone('0551234567'), '966551234567');
  assert.equal(normalizePhone('551234567'), '966551234567');
  assert.equal(normalizePhone('+966 55 123 4567'), '966551234567');
  assert.equal(normalizePhone('00966551234567'), '966551234567');
});

test('normalizePhone accepts digits typed on an Arabic or Persian keyboard', () => {
  assert.equal(normalizePhone('٠٥٥١٢٣٤٥٦٧'), '966551234567');
  assert.equal(normalizePhone('٥٥١٢٣٤٥٦٧'), '966551234567');
  assert.equal(normalizePhone('۰۵۵۱۲۳۴۵۶۷'), '966551234567');
});

test('normalizePhone leaves an empty or digit-less value empty', () => {
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
  assert.equal(normalizePhone('abc'), '');
});
