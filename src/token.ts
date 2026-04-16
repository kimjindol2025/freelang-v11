// FreeLang v9: Token types

export enum TokenType {
  // Literals
  Number = "Number",
  String = "String",
  Symbol = "Symbol",
  Keyword = "Keyword",
  Variable = "Variable", // $varname

  // Delimiters
  LBracket = "LBracket",   // [
  RBracket = "RBracket",   // ]
  LParen = "LParen",       // (
  RParen = "RParen",       // )
  LBrace = "LBrace",       // {
  RBrace = "RBrace",       // }

  // Phase 6 Keywords
  Module = "Module",       // MODULE
  TypeClass = "TypeClass", // TYPECLASS
  Instance = "Instance",   // INSTANCE
  Import = "Import",       // import
  Open = "Open",           // open

  // Phase 9a Keywords (Search)
  Search = "Search",       // search
  Fetch = "Fetch",         // fetch
  Browse = "Browse",       // browse
  Cache = "Cache",         // cache

  // Phase 9b Keywords (Learning)
  Learn = "Learn",         // learn
  Recall = "Recall",       // recall
  Remember = "Remember",   // remember
  Forget = "Forget",       // forget

  // Phase 9c Keywords (Reasoning)
  Observe = "Observe",     // observe
  Analyze = "Analyze",     // analyze
  Decide = "Decide",       // decide
  Act = "Act",             // act
  Verify = "Verify",       // verify

  // Phase 9c Keywords (Conditional)
  If = "If",               // if
  When = "When",           // when
  Then = "Then",           // then
  Else = "Else",           // else

  // Phase 9c Keywords (Loop Control)
  Repeat = "Repeat",       // repeat
  Until = "Until",         // until
  While = "While",         // while

  // Phase 11 Keywords (Web DSL)
  Page = "Page",           // PAGE
  Route = "Route",         // ROUTE
  Component = "Component", // COMPONENT
  Form = "Form",           // FORM
  State = "State",         // STATE
  Computed = "Computed",   // COMPUTED
  Watch = "Watch",         // WATCH
  Method = "Method",       // METHOD
  Render = "Render",       // RENDER
  Handler = "Handler",     // HANDLER
  Validation = "Validation", // VALIDATION
  Layout = "Layout",       // LAYOUT
  Middleware = "Middleware", // MIDDLEWARE
  Suspense = "Suspense",   // SUSPENSE
  Slot = "Slot",           // SLOT
  Metadata = "Metadata",   // METADATA

  // Phase 11 Keywords (Enterprise Backend)
  Service = "Service",     // SERVICE
  Controller = "Controller", // CONTROLLER
  Guard = "Guard",         // GUARD
  Pipe = "Pipe",           // PIPE

  // Phase 11 Keywords (Database ORM)
  Model = "Model",         // MODEL
  Query = "Query",         // QUERY
  Migration = "Migration", // MIGRATION
  Repository = "Repository", // REPOSITORY
  Database = "Database",   // DATABASE

  // Phase 11 Keywords (Cache & Messaging)
  Cached = "Cached",       // CACHED
  Kafka = "Kafka",         // KAFKA
  Producer = "Producer",   // PRODUCER
  Consumer = "Consumer",   // CONSUMER
  Queue = "Queue",         // QUEUE
  RabbitMQ = "RabbitMQ",   // RABBITMQ

  // Phase 11 Keywords (Authentication)
  JWT = "JWT",             // JWT
  OAuth = "OAuth",         // OAUTH

  // Phase 11 Keywords (Deployment)
  Dockerfile = "Dockerfile",           // DOCKERFILE
  DockerCompose = "DockerCompose",     // DOCKER-COMPOSE
  K8sDeployment = "K8sDeployment",     // K8S-DEPLOYMENT
  K8sService = "K8sService",           // K8S-SERVICE
  K8sIngress = "K8sIngress",           // K8S-INGRESS

  // Special
  Colon = "Colon",         // :
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}
