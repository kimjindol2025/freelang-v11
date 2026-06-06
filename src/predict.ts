// predict.ts — Phase 144: [PREDICT] 예측 + 신뢰구간
// AI가 미래를 예측하고 신뢰구간을 계산하는 시스템

export interface Prediction {
  value: number;       // 예측값
  lower: number;       // 하한 (예: 95% CI)
  upper: number;       // 상한
  confidence: number;  // 신뢰 수준 (0~1, 예: 0.95)
  method: string;      // 예측 방법
  horizon?: number;    // 예측 시점 (스텝)
}

export interface TimeSeriesPrediction {
  predictions: Prediction[];
  trend: 'up' | 'down' | 'flat' | 'volatile';
  seasonality?: number;  // 주기 (있으면)
  accuracy?: number;     // 회고 정확도 (테스트 시)
}

export interface ClassificationPrediction {
  classes: Array<{
    label: string;
    probability: number;
  }>;
  predicted: string;    // 최고 확률 클래스
  confidence: number;
}

// 통계 유틸리티
function mean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function variance(data: number[]): number {
  if (data.length < 2) return 0;
  const m = mean(data);
  return data.reduce((sum, x) => sum + (x - m) ** 2, 0) / (data.length - 1);
}

function stddev(data: number[]): number {
  return Math.sqrt(variance(data));
}

// 선형 회귀 계수 계산 (OLS)
function linearFit(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: data[0] };

  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = mean(xs);
  const my = mean(data);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (data[i] - my);
    den += (xs[i] - mx) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

// 잔차 표준 오차 계산
function residualStdError(data: number[], slope: number, intercept: number): number {
  const n = data.length;
  if (n < 3) return stddev(data) * 0.5;
  const residuals = data.map((y, i) => y - (intercept + slope * i));
  const sse = residuals.reduce((sum, r) => sum + r ** 2, 0);
  return Math.sqrt(sse / (n - 2));
}

// z-score for confidence intervals
function zScore(confidence: number): number {
  // 근사치: 0.90→1.645, 0.95→1.96, 0.99→2.576
  if (confidence >= 0.99) return 2.576;
  if (confidence >= 0.975) return 2.24;
  if (confidence >= 0.95) return 1.96;
  if (confidence >= 0.90) return 1.645;
  if (confidence >= 0.80) return 1.282;
  return 1.0;
}

export class Predictor {
  // 선형 회귀 예측
  linearRegression(data: number[], horizon: number = 1): Prediction {
    const { slope, intercept } = linearFit(data);
    const nextIdx = data.length - 1 + horizon;
    const value = intercept + slope * nextIdx;
    const se = residualStdError(data, slope, intercept);
    const z = zScore(0.95);
    // 최소 margin: 데이터 범위의 5% 또는 se 기반 margin 중 큰 값
    const minMargin = (Math.max(...data) - Math.min(...data)) * 0.05 + 1e-6;
    const margin = Math.max(minMargin, z * se * Math.sqrt(1 + (1 / data.length)));

    return {
      value,
      lower: value - margin,
      upper: value + margin,
      confidence: 0.95,
      method: "linear-regression",
      horizon,
    };
  }

  // 이동 평균 예측
  movingAverage(data: number[], window: number = 3, horizon: number = 1): Prediction {
    const w = Math.min(window, data.length);
    const slice = data.slice(data.length - w);
    const value = mean(slice);
    const sd = stddev(slice.length < 2 ? data : slice);
    const z = zScore(0.95);
    const margin = z * sd / Math.sqrt(w);

    return {
      value,
      lower: value - margin,
      upper: value + margin,
      confidence: 0.95,
      method: "moving-average",
      horizon,
    };
  }

  // 지수 평활 예측 (Exponential Smoothing)
  exponentialSmoothing(data: number[], alpha: number = 0.3, horizon: number = 1): Prediction {
    if (data.length === 0) {
      return { value: 0, lower: 0, upper: 0, confidence: 0.95, method: "exponential-smoothing", horizon };
    }

    let smoothed = data[0];
    for (let i = 1; i < data.length; i++) {
      smoothed = alpha * data[i] + (1 - alpha) * smoothed;
    }

    const errors = [];
    let s = data[0];
    for (let i = 1; i < data.length; i++) {
      const prev = s;
      s = alpha * data[i] + (1 - alpha) * prev;
      errors.push(data[i] - prev);
    }

    const se = errors.length > 0 ? stddev(errors) : stddev(data) * 0.5;
    const z = zScore(0.95);
    const margin = z * se;

    return {
      value: smoothed,
      lower: smoothed - margin,
      upper: smoothed + margin,
      confidence: 0.95,
      method: "exponential-smoothing",
      horizon,
    };
  }

  // 시계열 다중 예측
  forecastTimeSeries(data: number[], steps: number = 3): TimeSeriesPrediction {
    const trend = this.detectTrend(data);
    const predictions: Prediction[] = [];

    for (let h = 1; h <= steps; h++) {
      predictions.push(this.linearRegression(data, h));
    }

    // 계절성 감지: 자기상관 이용
    let seasonality: number | undefined = undefined;
    if (data.length >= 8) {
      const bestPeriod = this._detectSeasonality(data);
      if (bestPeriod > 1) seasonality = bestPeriod;
    }

    // 회고 정확도: 마지막 20% 데이터로 검증
    let accuracy: number | undefined = undefined;
    if (data.length >= 5) {
      const splitIdx = Math.floor(data.length * 0.8);
      const trainData = data.slice(0, splitIdx);
      const testData = data.slice(splitIdx);
      const testPreds = testData.map((_, i) => {
        const { slope, intercept } = linearFit(trainData);
        return intercept + slope * (trainData.length + i);
      });
      const mae = mean(testData.map((actual, i) => Math.abs(actual - testPreds[i])));
      const range = Math.max(...data) - Math.min(...data);
      accuracy = range > 0 ? Math.max(0, 1 - mae / range) : 0.5;
    }

    return { predictions, trend, seasonality, accuracy };
  }

  // 신뢰구간 계산 (부트스트랩)
  confidenceInterval(samples: number[], confidence: number = 0.95): { lower: number; upper: number } {
    if (samples.length === 0) return { lower: 0, upper: 0 };

    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;
    const alpha = 1 - confidence;
    const lowerIdx = Math.floor((alpha / 2) * n);
    const upperIdx = Math.ceil((1 - alpha / 2) * n) - 1;

    // 데이터가 적을 때는 정규 근사
    if (n < 30) {
      const m = mean(samples);
      const sd = stddev(samples);
      const z = zScore(confidence);
      const margin = z * sd / Math.sqrt(n);
      return { lower: m - margin, upper: m + margin };
    }

    return {
      lower: sorted[Math.max(0, lowerIdx)],
      upper: sorted[Math.min(n - 1, upperIdx)],
    };
  }

  // 분류 예측 (K-NN 스타일 + 나이브 베이즈 유사)
  classify(
    features: Record<string, number>,
    trainingData: Array<{ features: Record<string, number>; label: string }>
  ): ClassificationPrediction {
    if (trainingData.length === 0) {
      return {
        classes: [{ label: "unknown", probability: 1.0 }],
        predicted: "unknown",
        confidence: 0,
      };
    }

    // 유클리드 거리 기반 KNN
    const distances = trainingData.map(item => {
      const keys = Object.keys(features);
      let dist = 0;
      for (const k of keys) {
        const fv = features[k] ?? 0;
        const tv = item.features[k] ?? 0;
        dist += (fv - tv) ** 2;
      }
      return { label: item.label, dist: Math.sqrt(dist) };
    });

    distances.sort((a, b) => a.dist - b.dist);
    const k = Math.min(5, distances.length);
    const neighbors = distances.slice(0, k);

    // 가중치: 거리 역수
    const labelWeights: Record<string, number> = {};
    let totalWeight = 0;
    for (const n of neighbors) {
      const w = n.dist === 0 ? 1e6 : 1 / (n.dist + 1e-10);
      labelWeights[n.label] = (labelWeights[n.label] ?? 0) + w;
      totalWeight += w;
    }

    const classes = Object.entries(labelWeights)
      .map(([label, w]) => ({ label, probability: w / totalWeight }))
      .sort((a, b) => b.probability - a.probability);

    const predicted = classes[0]?.label ?? "unknown";
    const confidence = classes[0]?.probability ?? 0;

    return { classes, predicted, confidence };
  }

  // 예측 정확도 평가
  evaluate(predictions: number[], actuals: number[]): {
    mae: number;
    rmse: number;
    mape: number;
  } {
    const n = Math.min(predictions.length, actuals.length);
    if (n === 0) return { mae: 0, rmse: 0, mape: 0 };

    let sumAE = 0;
    let sumSE = 0;
    let sumAPE = 0;
    let mapeCount = 0;

    for (let i = 0; i < n; i++) {
      const err = predictions[i] - actuals[i];
      sumAE += Math.abs(err);
      sumSE += err ** 2;
      if (actuals[i] !== 0) {
        sumAPE += Math.abs(err / actuals[i]) * 100;
        mapeCount++;
      }
    }

    return {
      mae: sumAE / n,
      rmse: Math.sqrt(sumSE / n),
      mape: mapeCount > 0 ? sumAPE / mapeCount : 0,
    };
  }

  // 트렌드 감지
  detectTrend(data: number[]): 'up' | 'down' | 'flat' | 'volatile' {
    if (data.length < 2) return 'flat';

    const { slope, intercept } = linearFit(data);
    const n = data.length;

    // R-squared 계산으로 선형성 측정
    const yMean = mean(data);
    const ssTot = data.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
    const ssRes = data.reduce((sum, y, i) => sum + (y - (intercept + slope * i)) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;

    // R-squared가 높으면 선형 트렌드 (up/down/flat)
    if (rSquared >= 0.7) {
      const range = Math.max(...data) - Math.min(...data);
      const normalizedSlope = range > 0 ? slope / range : slope;
      if (Math.abs(normalizedSlope) < 0.05) return 'flat';
      if (normalizedSlope > 0) return 'up';
      return 'down';
    }

    // 선형성이 낮을 때 CV로 판단
    const sd = stddev(data);
    const m = Math.abs(yMean);
    const cv = m > 0 ? sd / m : sd;

    if (cv > 0.3) return 'volatile';

    const range = Math.max(...data) - Math.min(...data);
    const normalizedSlope = range > 0 ? slope / range : slope;
    if (Math.abs(normalizedSlope) < 0.05) return 'flat';
    if (normalizedSlope > 0) return 'up';
    return 'down';
  }

  // 계절성 감지 (자기상관 기반)
  private _detectSeasonality(data: number[]): number {
    const n = data.length;
    const m = mean(data);
    let bestPeriod = 0;
    let bestCorr = 0;

    const maxLag = Math.floor(n / 2);
    for (let lag = 2; lag <= maxLag; lag++) {
      let num = 0;
      let den1 = 0;
      let den2 = 0;
      for (let i = lag; i < n; i++) {
        const a = data[i] - m;
        const b = data[i - lag] - m;
        num += a * b;
        den1 += a ** 2;
        den2 += b ** 2;
      }
      const corr = (den1 * den2 > 0) ? num / Math.sqrt(den1 * den2) : 0;
      if (corr > bestCorr) {
        bestCorr = corr;
        bestPeriod = lag;
      }
    }

    return bestCorr > 0.5 ? bestPeriod : 0;
  }
}

export const globalPredictor = new Predictor();
