// stdlib-text-processor.ts — NLP utilities: regex extraction, tokenization, similarity, sentiment
// Extends string-ext with advanced text processing

// ── Internal helpers ───────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  const dp: number[][] = Array(aLen + 1)
    .fill(0)
    .map(() => Array(bLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) dp[i][0] = i;
  for (let j = 0; j <= bLen; j++) dp[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[aLen][bLen];
}

function tokenizeToWords(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .match(/\b\w+\b/g) || [];
}

function calculateJaccard(a: string, b: string): number {
  const wordsA = new Set(tokenizeToWords(a));
  const wordsB = new Set(tokenizeToWords(b));

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 1.0;
  return intersection.size / union.size;
}

// Sentiment dictionary (기본 한영 감정 단어)
const positiveWords = new Set([
  "good",
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "perfect",
  "love",
  "best",
  "beautiful",
  "happy",
  "glad",
  "brilliant",
  "fantastic",
  "awesome",
  "positive",
  "success",
  "succeeded",
  "great",
  "좋다",
  "훌륭하다",
  "멋진",
  "아름답다",
  "행복하다",
  "기쁘다",
  "완벽하다",
  "최고",
  "사랑",
  "성공",
]);

const negativeWords = new Set([
  "bad",
  "terrible",
  "awful",
  "horrible",
  "wrong",
  "hate",
  "worst",
  "ugly",
  "sad",
  "angry",
  "depressed",
  "disappointing",
  "fail",
  "failed",
  "error",
  "problem",
  "negative",
  "싫다",
  "형편없다",
  "못생겼다",
  "슬프다",
  "화나다",
  "실패",
  "문제",
  "나쁘다",
  "끔찍하다",
]);

// ── Module ─────────────────────────────────────────────────────────────────

export function createTextProcessorModule() {
  return {
    // ── Regex extraction ───────────────────────────────────────

    // text_re_find pattern text → first match string | null
    text_re_find: (pattern: string, text: string): string | null => {
      try {
        if (typeof pattern !== "string" || typeof text !== "string") return null;
        const match = text.match(new RegExp(pattern));
        return match ? match[0] : null;
      } catch {
        return null;
      }
    },

    // text_re_find_all pattern text → array of matches
    text_re_find_all: (pattern: string, text: string): string[] => {
      try {
        if (typeof pattern !== "string" || typeof text !== "string") return [];
        const matches = text.match(new RegExp(pattern, "g"));
        return matches || [];
      } catch {
        return [];
      }
    },

    // text_re_replace pattern replacement text → replaced string
    text_re_replace: (pattern: string, replacement: string, text: string): string | null => {
      try {
        if (typeof pattern !== "string" || typeof replacement !== "string" || typeof text !== "string") {
          return null;
        }
        return text.replace(new RegExp(pattern), replacement);
      } catch {
        return null;
      }
    },

    // ── Tokenization ───────────────────────────────────────────

    // text_sentences text → array of sentences
    text_sentences: (text: string): string[] => {
      if (typeof text !== "string") return [];
      return text
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    },

    // text_ngrams text n → array of n-grams
    text_ngrams: (text: string, n: number): string[] => {
      if (typeof text !== "string" || typeof n !== "number" || n < 1) return [];
      const words = tokenizeToWords(text);
      const grams: string[] = [];
      for (let i = 0; i <= words.length - n; i++) {
        grams.push(words.slice(i, i + n).join(" "));
      }
      return grams;
    },

    // text_word_freq text → {word: count, ...}
    text_word_freq: (text: string): any => {
      if (typeof text !== "string") return {};
      const words = tokenizeToWords(text);
      const freq: any = {};
      words.forEach((word) => {
        freq[word] = (freq[word] || 0) + 1;
      });
      return freq;
    },

    // ── Similarity ─────────────────────────────────────────────

    // text_levenshtein a b → edit distance (integer)
    text_levenshtein: (a: string, b: string): number => {
      if (typeof a !== "string" || typeof b !== "string") return 0;
      return levenshteinDistance(a, b);
    },

    // text_similarity a b → Jaccard coefficient (0.0-1.0)
    text_similarity: (a: string, b: string): number => {
      if (typeof a !== "string" || typeof b !== "string") return 0;
      return calculateJaccard(a, b);
    },

    // text_fuzzy_match query candidates → best matching string
    text_fuzzy_match: (query: string, candidates: string[]): string | null => {
      if (typeof query !== "string" || !Array.isArray(candidates)) return null;
      if (candidates.length === 0) return null;

      let bestMatch = candidates[0];
      let bestScore = calculateJaccard(query, candidates[0]);

      for (let i = 1; i < candidates.length; i++) {
        const score = calculateJaccard(query, candidates[i]);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidates[i];
        }
      }

      return bestMatch;
    },

    // ── Sentiment analysis (dictionary-based) ──────────────────

    // text_sentiment text → {label, score, positive_words, negative_words}
    text_sentiment: (text: string): any => {
      if (typeof text !== "string") {
        return {
          label: "neutral",
          score: 0,
          positive_words: [],
          negative_words: [],
        };
      }

      const words = tokenizeToWords(text);
      const positiveFound: string[] = [];
      const negativeFound: string[] = [];

      words.forEach((word) => {
        if (positiveWords.has(word)) positiveFound.push(word);
        if (negativeWords.has(word)) negativeFound.push(word);
      });

      const posCount = positiveFound.length;
      const negCount = negativeFound.length;

      let score = 0;
      let label = "neutral";

      if (posCount + negCount > 0) {
        score = (posCount - negCount) / (posCount + negCount);
        if (score > 0.2) label = "positive";
        else if (score < -0.2) label = "negative";
        else label = "neutral";
      }

      return {
        label,
        score,
        positive_words: positiveFound,
        negative_words: negativeFound,
      };
    },

    // ── Keyword extraction ─────────────────────────────────────

    // text_keywords text n → top n keywords by frequency
    text_keywords: (text: string, n: number): string[] => {
      if (typeof text !== "string" || typeof n !== "number" || n < 1) return [];

      const freq = this.text_word_freq(text);
      const sorted = Object.entries(freq)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, n)
        .map((e: any) => e[0]);

      return sorted;
    },

    // text_summarize text max_sentences → array of key sentences
    text_summarize: (text: string, max_sentences: number): string[] => {
      if (typeof text !== "string" || typeof max_sentences !== "number") return [];

      const sentences = (text || "")
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (sentences.length <= max_sentences) return sentences;

      // Simple heuristic: first and last sentences are important
      const result: string[] = [];
      result.push(sentences[0]);

      // Add middle sentences with highest word frequency
      const wordFreq = this.text_word_freq(text);
      const middleSentences = sentences.slice(1, -1);
      const scored = middleSentences
        .map((sent) => {
          const words = tokenizeToWords(sent);
          const score = words.reduce((sum, w) => sum + (wordFreq[w] || 0), 0);
          return { sent, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, max_sentences - 2))
        .map((x) => x.sent);

      result.push(...scored);

      if (sentences.length > 1 && result.length < max_sentences) {
        result.push(sentences[sentences.length - 1]);
      }

      return result.slice(0, max_sentences);
    },
  };
}
