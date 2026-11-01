# node-cqrs-starter

A minimal, production-minded **CQRS (Command Query Responsibility Segregation)** boilerplate for Node.js — command/query separation, event handlers, and the architectural trade-offs that actually matter.

> This is not a framework. It's the smallest set of pieces you need to understand before you build CQRS into a real system — and the honest trade-offs you'll hit on day 1.

---

## Why CQRS?

In a typical CRUD app, the same model handles reads and writes. That works until it doesn't — usually when:

- Your **read load** is 100x your write load, and you want to scale them independently
- Your **write side** needs strong consistency, but reads can tolerate eventual consistency
- Your **business logic** on writes is complex (validation, workflows, side effects) and shoving it into the same model as queries makes everything slow
- You need an **audit trail** of every change (event sourcing comes later, naturally)

I built Fatura's BNPL credit system with CQRS. It handled live wallet transactions where **writes had to be bulletproof** (money) but **reads were everywhere** (dashboards, mobile apps, retailer views). Separating them was the only sane choice.

---

## The core idea in one picture

```
Client ---> Command Bus ---> Write Model ---+
                                             |
                                             v
                                       Domain Event
                                             |
Client ---> Query Bus  ---> Read Model <----+
```

**Writes** go through commands -> produce events -> events update read models.
**Reads** go through queries -> hit optimized read models directly.

---

## What's in this repo

```
src/
  commands/
    command.interface.ts        # Command marker interface
    command-bus.ts              # In-memory command dispatcher
  queries/
    query.interface.ts
    query-bus.ts
  events/
    event.interface.ts
    event-bus.ts
  handlers/
    command-handler.interface.ts
    query-handler.interface.ts
  example/
    create-order.command.ts
    create-order.handler.ts
    order-created.event.ts
    get-order.query.ts
    get-order.handler.ts
```

---

## Example usage

```typescript
import { CommandBus, QueryBus, EventBus } from './src';
import { CreateOrderCommand, CreateOrderHandler } from './src/example';
import { GetOrderQuery, GetOrderHandler } from './src/example';

const commandBus = new CommandBus();
const queryBus = new QueryBus();
const eventBus = new EventBus();

// Register handlers at startup
commandBus.register(CreateOrderCommand, new CreateOrderHandler(eventBus));
queryBus.register(GetOrderQuery, new GetOrderHandler());

// Fire a command
await commandBus.execute(new CreateOrderCommand({
  customerId: 'cust_123',
  items: [{ sku: 'ABC', qty: 2 }],
}));

// Later, fire a query
const order = await queryBus.execute(new GetOrderQuery('order_456'));
```

---

## Honest trade-offs

CQRS is often oversold. Here's when NOT to use it:

| Don't use CQRS if | Use CQRS if |
|---|---|
| Your reads and writes are both low-volume | You have a strong asymmetry between read and write load |
| Your domain is simple CRUD | Your write model needs rich business logic |
| You can't tolerate eventual consistency on reads | You can embrace eventual consistency for read models |
| Your team doesn't own the operational complexity | You have the capacity to run two sides of the system |

**My rule of thumb:** if you're introducing CQRS "for scale" before you've measured the bottleneck, you're adding complexity for free. Measure first.

---

## What's intentionally NOT in this repo

- **No event sourcing.** You can add it on top of CQRS, but they're not the same thing.
- **No framework coupling.** No NestJS modules, no decorators. Plain classes so you can port the pattern anywhere.
- **No persistence layer.** Pick your own (PostgreSQL for the write side + Redis or a read-optimized DB for the read side is a solid default).
- **No distributed transport.** The buses here are in-memory. In production you'd back the event bus with RabbitMQ, Kafka, or similar.

---

## Who this is for

Backend engineers who've heard "CQRS" thrown around in system-design interviews and want to see the smallest possible working version — plus the context of why it's used in anger.

---

## About the author

Built by [Ahmed Samy](https://www.linkedin.com/in/ahmed-samy-aa16751b4/) — Senior Backend Engineer who's used CQRS on BNPL credit systems at scale.

If this helped you, a star is appreciated.
