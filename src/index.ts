/**
 * node-cqrs-starter
 *
 * The smallest working CQRS implementation in TypeScript.
 * Three in-memory buses + the interfaces you register against.
 *
 * Replace the in-memory parts with RabbitMQ / Kafka / Postgres
 * when you're ready to go distributed.
 */

// --------------------------------------------------------------------
// Core interfaces
// --------------------------------------------------------------------

export interface Command<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
}

export interface Query<TResult = unknown, TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  // phantom field so TResult is used in the type signature
  readonly __result?: TResult;
}

export interface DomainEvent<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export interface CommandHandler<TCommand extends Command> {
  handle(command: TCommand): Promise<void>;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

export type EventHandler<TEvent extends DomainEvent> = (event: TEvent) => Promise<void> | void;

// --------------------------------------------------------------------
// Command Bus — one handler per command type
// --------------------------------------------------------------------

export class CommandBus {
  private handlers = new Map<string, CommandHandler<Command>>();

  register<T extends Command>(type: string, handler: CommandHandler<T>): void {
    if (this.handlers.has(type)) {
      throw new Error(`Command type "${type}" already has a handler.`);
    }
    this.handlers.set(type, handler as CommandHandler<Command>);
  }

  async execute<T extends Command>(command: T): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command "${command.type}".`);
    }
    await handler.handle(command);
  }
}

// --------------------------------------------------------------------
// Query Bus — one handler per query type
// --------------------------------------------------------------------

export class QueryBus {
  private handlers = new Map<string, QueryHandler<Query, unknown>>();

  register<TQuery extends Query, TResult>(
    type: string,
    handler: QueryHandler<TQuery, TResult>,
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(`Query type "${type}" already has a handler.`);
    }
    this.handlers.set(type, handler as QueryHandler<Query, unknown>);
  }

  async execute<TQuery extends Query, TResult>(query: TQuery): Promise<TResult> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for query "${query.type}".`);
    }
    return (await handler.handle(query)) as TResult;
  }
}

// --------------------------------------------------------------------
// Event Bus — many handlers per event type (fan-out)
// --------------------------------------------------------------------

export class EventBus {
  private handlers = new Map<string, EventHandler<DomainEvent>[]>();

  subscribe<T extends DomainEvent>(type: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(type, list);
  }

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const list = this.handlers.get(event.type) ?? [];
    // Fan-out: don't let one slow handler block the rest.
    await Promise.all(list.map((h) => Promise.resolve(h(event))));
  }
}
