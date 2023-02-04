import { split_text_by_tokens } from '../tokenizer';

// source of truth for tokenizing: https://platform.openai.com/tokenizer?view=bpe

describe("split_text_by_tokens", () => {
  test("empty text", async () => {
    expect(await split_text_by_tokens("", 10)).toEqual([])
  })
});

describe("split_text_by_tokens", () => {
  test("1 token chunking without overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 1)).toEqual(
      ["Hello", " world", "!", " This", " is", " a", " test", "."])
  })
});

describe("split_text_by_tokens", () => {
  test("2 token chunking without overlap; odd number of tokens", async () => {
    expect(await split_text_by_tokens("Hello world! This is still a test.", 2)).toEqual(
      ["Hello world", "! This", " is still", " a test", "."])
  })
});

describe("split_text_by_tokens", () => {
  test("whitespace", async () => {
    expect(await split_text_by_tokens(" \n ", 1)).toEqual([" ", "\n", " "])
  })
});

describe("split_text_by_tokens", () => {
  test("2 token chunking with 1 overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 2, 1)).toEqual(
      ["Hello world", " world!", "! This", " This is", " is a", " a test", " test."])
  })
});

describe("split_text_by_tokens", () => {
  test("2 token chunking with 1 overlap; odd number of tokens", async () => {
    expect(await split_text_by_tokens("Hello world! This is still a test.", 2, 1)).toEqual(
      ["Hello world", " world!", "! This", " This is", " is still", " still a", " a test", " test."])
  })
});

describe("split_text_by_tokens", () => {
  test("3 token chunking with 1 overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 3, 1)).toEqual(
      ["Hello world!", "! This is", " is a test", " test."])
  })
});

describe("split_text_by_tokens", () => {
  test("3 token chunking with 1 overlap; odd number of tokens", async () => {
    expect(await split_text_by_tokens("Hello world! This is still a test.", 3, 1)).toEqual(
      ["Hello world!", "! This is", " is still a", " a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("3 token chunking with 2 overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 3, 2)).toEqual(
      ["Hello world!", " world! This", "! This is", " This is a", " is a test", " a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("3 token chunking with 2 overlap; odd number of tokens", async () => {
    expect(await split_text_by_tokens("Hello world! This is still a test.", 3, 2)).toEqual(
      ["Hello world!", " world! This", "! This is", " This is still", " is still a", " still a test", " a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("chunk size equal to text length returns single chunk with text", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 8)).toEqual(
      ["Hello world! This is a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("chunk size equal to text length returns single chunk with text, despite chunk_overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 8, 1)).toEqual(
      ["Hello world! This is a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("chunk size longer than text returns single chunk with text", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 9)).toEqual(
      ["Hello world! This is a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("chunk size longer than text returns single chunk with text, despite chunk_overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 9, 1)).toEqual(
      ["Hello world! This is a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("large chunk size and large chunk overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 7, 6)).toEqual(
      ["Hello world! This is a test", " world! This is a test."])
  })
});

describe("split_text_by_tokens", () => {
  test("large chunk size and small chunk overlap", async () => {
    expect(await split_text_by_tokens("Hello world! This is a test.", 7, 1)).toEqual(
      ["Hello world! This is a test", " test."])
  })
});

describe("split_text_by_tokens", () => {
  test("chunk overlap larger than chunk size throws error", async () => {
    expect(split_text_by_tokens("Hello world! This is still a test.", 2, 3)).rejects.toThrow("chunk_overlap must be less than chunk_size")
  })
});

describe("split_text_by_tokens", () => {
  test("chunk overlap equal chunk size throws error", async () => {
    expect(split_text_by_tokens("Hello world! This is still a test.", 3, 3)).rejects.toThrow("chunk_overlap must be less than chunk_size")
  })
});

describe("split_text_by_tokens", () => {
  test("chunk size 0 with empty text", async () => {
    expect(split_text_by_tokens("", 0)).rejects.toThrow("chunk_overlap must be less than chunk_size")
  })
});

describe("split_text_by_tokens", () => {
  test("chunk size 0 with non-empty text", async () => {
    expect(split_text_by_tokens("a", 0)).rejects.toThrow("chunk_overlap must be less than chunk_size")
  })
});

describe("split_text_by_tokens", () => {
  test("negative chunk size throws", async () => {
    expect(split_text_by_tokens("test", -1, -2)).rejects.toThrow("chunk_size must be non-negative")
  })
});

describe("split_text_by_tokens", () => {
  test("negative overlap throws", async () => {
    expect(split_text_by_tokens("test", 0, -1)).rejects.toThrow("chunk_overlap must be non-negative")
  })
});
