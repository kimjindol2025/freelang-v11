"use strict";
// FreeLang v9: Token types
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Literals
    TokenType["Number"] = "Number";
    TokenType["String"] = "String";
    TokenType["Symbol"] = "Symbol";
    TokenType["Keyword"] = "Keyword";
    TokenType["Variable"] = "Variable";
    // Delimiters
    TokenType["LBracket"] = "LBracket";
    TokenType["RBracket"] = "RBracket";
    TokenType["LParen"] = "LParen";
    TokenType["RParen"] = "RParen";
    TokenType["LBrace"] = "LBrace";
    TokenType["RBrace"] = "RBrace";
    // Phase 6 Keywords
    TokenType["Module"] = "Module";
    TokenType["TypeClass"] = "TypeClass";
    TokenType["Instance"] = "Instance";
    TokenType["Import"] = "Import";
    TokenType["Open"] = "Open";
    // Phase 9a Keywords (Search)
    TokenType["Search"] = "Search";
    TokenType["Fetch"] = "Fetch";
    TokenType["Browse"] = "Browse";
    TokenType["Cache"] = "Cache";
    // Phase 9b Keywords (Learning)
    TokenType["Learn"] = "Learn";
    TokenType["Recall"] = "Recall";
    TokenType["Remember"] = "Remember";
    TokenType["Forget"] = "Forget";
    // Phase 9c Keywords (Reasoning)
    TokenType["Observe"] = "Observe";
    TokenType["Analyze"] = "Analyze";
    TokenType["Decide"] = "Decide";
    TokenType["Act"] = "Act";
    TokenType["Verify"] = "Verify";
    // Phase 9c Keywords (Conditional)
    TokenType["If"] = "If";
    TokenType["When"] = "When";
    TokenType["Then"] = "Then";
    TokenType["Else"] = "Else";
    // Phase 9c Keywords (Loop Control)
    TokenType["Repeat"] = "Repeat";
    TokenType["Until"] = "Until";
    TokenType["While"] = "While";
    // Phase 11 Keywords (Web DSL)
    TokenType["Page"] = "Page";
    TokenType["Api"] = "Api";
    TokenType["Route"] = "Route";
    TokenType["Component"] = "Component";
    TokenType["Form"] = "Form";
    TokenType["State"] = "State";
    TokenType["Computed"] = "Computed";
    TokenType["Watch"] = "Watch";
    TokenType["Method"] = "Method";
    TokenType["Render"] = "Render";
    TokenType["Handler"] = "Handler";
    TokenType["Validation"] = "Validation";
    TokenType["Layout"] = "Layout";
    TokenType["Middleware"] = "Middleware";
    TokenType["Suspense"] = "Suspense";
    TokenType["Slot"] = "Slot";
    TokenType["Metadata"] = "Metadata";
    // Phase 11 Keywords (Enterprise Backend)
    TokenType["Service"] = "Service";
    TokenType["Controller"] = "Controller";
    TokenType["Guard"] = "Guard";
    TokenType["Pipe"] = "Pipe";
    // Phase 11 Keywords (Database ORM)
    TokenType["Model"] = "Model";
    TokenType["Query"] = "Query";
    TokenType["Migration"] = "Migration";
    TokenType["Repository"] = "Repository";
    TokenType["Database"] = "Database";
    // Phase 11 Keywords (Cache & Messaging)
    TokenType["Cached"] = "Cached";
    TokenType["Kafka"] = "Kafka";
    TokenType["Producer"] = "Producer";
    TokenType["Consumer"] = "Consumer";
    TokenType["Queue"] = "Queue";
    TokenType["RabbitMQ"] = "RabbitMQ";
    // Phase 11 Keywords (Authentication)
    TokenType["JWT"] = "JWT";
    TokenType["OAuth"] = "OAuth";
    // Phase 11 Keywords (Deployment)
    TokenType["Dockerfile"] = "Dockerfile";
    TokenType["DockerCompose"] = "DockerCompose";
    TokenType["K8sDeployment"] = "K8sDeployment";
    TokenType["K8sService"] = "K8sService";
    TokenType["K8sIngress"] = "K8sIngress";
    // Phase 11 Keywords (Cloud)
    TokenType["AWS"] = "AWS";
    TokenType["AwsS3"] = "AwsS3";
    TokenType["AwsLambda"] = "AwsLambda";
    TokenType["AwsRds"] = "AwsRds";
    TokenType["AwsSqs"] = "AwsSqs";
    TokenType["GCP"] = "GCP";
    TokenType["GcpCloudRun"] = "GcpCloudRun";
    TokenType["GcpBigquery"] = "GcpBigquery";
    TokenType["Azure"] = "Azure";
    TokenType["AzureFunction"] = "AzureFunction";
    TokenType["AzureCosmos"] = "AzureCosmos";
    // Special
    TokenType["Colon"] = "Colon";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
