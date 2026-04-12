export interface Prediction {
    value: number;
    lower: number;
    upper: number;
    confidence: number;
    method: string;
    horizon?: number;
}
export interface TimeSeriesPrediction {
    predictions: Prediction[];
    trend: 'up' | 'down' | 'flat' | 'volatile';
    seasonality?: number;
    accuracy?: number;
}
export interface ClassificationPrediction {
    classes: Array<{
        label: string;
        probability: number;
    }>;
    predicted: string;
    confidence: number;
}
export declare class Predictor {
    linearRegression(data: number[], horizon?: number): Prediction;
    movingAverage(data: number[], window?: number, horizon?: number): Prediction;
    exponentialSmoothing(data: number[], alpha?: number, horizon?: number): Prediction;
    forecastTimeSeries(data: number[], steps?: number): TimeSeriesPrediction;
    confidenceInterval(samples: number[], confidence?: number): {
        lower: number;
        upper: number;
    };
    classify(features: Record<string, number>, trainingData: Array<{
        features: Record<string, number>;
        label: string;
    }>): ClassificationPrediction;
    evaluate(predictions: number[], actuals: number[]): {
        mae: number;
        rmse: number;
        mape: number;
    };
    detectTrend(data: number[]): 'up' | 'down' | 'flat' | 'volatile';
    private _detectSeasonality;
}
export declare const globalPredictor: Predictor;
//# sourceMappingURL=predict.d.ts.map