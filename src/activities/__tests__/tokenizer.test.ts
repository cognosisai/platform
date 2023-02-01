import { sentence_tokenizer } from '../tokenizer';

describe('split_text_by_tokens', () => {
  test('empty text', async () => {
    await expect(sentence_tokenizer("")).rejects.toThrow();
  });
});
