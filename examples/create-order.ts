/**
 * examples/create-order.ts
 *
 * End-to-end CQRS example: create an order (command),
 * emit an event that updates a read model, then query the read model.
 *
 * Run with: npx ts-node examples/create-order.ts
 */

import {
  Command,
  CommandBus,
  CommandHandler,
  DomainEvent,
  EventBus,
  Query,
  QueryBus,
  QueryHandler,
} from '../src';

// --------------------------------------------------------------------
// Domain
// --------------------------------------------------------------------

type OrderItem = { sku: string; qty: number };
type Order = { id: string; customerId: string; items: OrderItem[]; createdAt: Date };

// Tiny in-memory read model. Real projects would use a dedicated
// read store (Postgres view, Redis hash, Elasticsearch index, etc.).
const orders = new Map<string, Order>();

// --------------------------------------------------------------------
// Command + Handler
// --------------------------------------------------------------------

type CreateOrderPayload = { customerId: string; items: OrderItem[] };

class CreateOrderCommand implements Command<CreateOrderPayload> {
  readonly type = 'order.create';
  constructor(public readonly payload: CreateOrderPayload) {}
}

class CreateOrderHandler implements CommandHandler<CreateOrderCommand> {
  constructor(private readonly events: EventBus) {}

  async handle(command: CreateOrderCommand): Promise<void> {
    const order: Order = {
      id: `order_${Date.now()}`,
      customerId: command.payload.customerId,
      items: command.payload.items,
      createdAt: new Date(),
    };

    // In production the write model is persisted here (Postgres, etc.)
    // and the event is published AFTER the write commits.
    await this.events.publish<OrderCreatedEvent>({
      type: 'order.created',
      payload: order,
      occurredAt: new Date(),
    });
  }
}

// --------------------------------------------------------------------
// Event + Projection (updates the read model)
// --------------------------------------------------------------------

interface OrderCreatedEvent extends DomainEvent<Order> {
  readonly type: 'order.created';
}

const orderCreatedProjection = (event: OrderCreatedEvent): void => {
  orders.set(event.payload.id, event.payload);
};

// --------------------------------------------------------------------
// Query + Handler
// --------------------------------------------------------------------

type GetOrderPayload = { id: string };

class GetOrderQuery implements Query<Order | null, GetOrderPayload> {
  readonly type = 'order.get';
  constructor(public readonly payload: GetOrderPayload) {}
}

class GetOrderHandler implements QueryHandler<GetOrderQuery, Order | null> {
  async handle(query: GetOrderQuery): Promise<Order | null> {
    return orders.get(query.payload.id) ?? null;
  }
}

// --------------------------------------------------------------------
// Wire it up and run
// --------------------------------------------------------------------

async function main(): Promise<void> {
  const commandBus = new CommandBus();
  const queryBus = new QueryBus();
  const eventBus = new EventBus();

  // Register at startup. Handlers are plain classes, no decorators needed.
  commandBus.register('order.create', new CreateOrderHandler(eventBus));
  queryBus.register('order.get', new GetOrderHandler());
  eventBus.subscribe<OrderCreatedEvent>('order.created', orderCreatedProjection);

  // Write side: fire the command.
  await commandBus.execute(
    new CreateOrderCommand({
      customerId: 'cust_42',
      items: [{ sku: 'SKU-001', qty: 2 }],
    }),
  );

  // Read side: query the read model.
  const [latestOrderId] = Array.from(orders.keys());
  const order = await queryBus.execute<GetOrderQuery, Order | null>(
    new GetOrderQuery({ id: latestOrderId }),
  );

  console.log('Read model has:', order);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
