import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { CreateOrderInput, CreateOrderOutput } from './dto/create-order.dto';
import { User, UserRole } from 'src/users/entities/user.entity';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { GetOrdersInput, GetOrdersOutput } from './dto/get-orders.dto';
import { GetOrderInput, GetOrderOutput } from './dto/get-order.dto';
import { EditOrderInput, EditOrderOutput } from './dto/edit-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly dishes: Repository<Dish>,
  ) {}

  async createOrder(
    customer: User,
    { restaurantId, items }: CreateOrderInput,
  ): Promise<CreateOrderOutput> {
    try {
      const restaurant = await this.restaurants.findOne({
        where: { id: restaurantId },
      });
      if (!restaurant) {
        return { ok: false, error: 'Restaurant not found.' };
      }
      let orderFinalPrice = 0;
      const oderItems: OrderItem[] = [];
      for (const item of items) {
        const dish = await this.dishes.findOne({ where: { id: item.dishId } });
        if (!dish) {
          return { ok: false, error: 'Dish not found.' };
        }
        let dishFinalPrice = dish.price;
        for (const itemOption of item.options || []) {
          const dishOption = dish.options?.find(
            (option) => option.name === itemOption.name,
          );
          if (dishOption) {
            if (dishOption.extra) {
              dishFinalPrice += dishOption.extra;
            } else {
              const dishOptionChoice = dishOption.choices?.find(
                (choice) => choice.name === itemOption.choice,
              );
              if (!dishOptionChoice) {
                return { ok: false, error: 'Dish option choice not found.' };
              }
              if (dishOptionChoice.extra) {
                dishFinalPrice += dishOptionChoice.extra;
              }
            }
          }
        }
        orderFinalPrice += dishFinalPrice;
        const orderItem = this.orderItems.create({
          dish,
          options: item.options,
        });
        await this.orderItems.save(orderItem);
        oderItems.push(orderItem);
      }
      const order = this.orders.create({
        customer,
        restaurant,
        items: oderItems,
        total: orderFinalPrice,
      });
      await this.orders.save(order);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not create order.' };
    }
  }

  async getOrders(
    user: User,
    { status }: GetOrdersInput,
  ): Promise<GetOrdersOutput> {
    try {
      let orders: Order[];
      if (user.role === UserRole.Client) {
        orders = await this.orders.find({
          where: { customer: user, ...(status && { status }) },
        });
      } else if (user.role === UserRole.Delivery) {
        orders = await this.orders.find({
          where: { driver: user, ...(status && { status }) },
        });
      } else if (user.role === UserRole.Owner) {
        const restaurants = await this.restaurants.find({
          where: { owner: user },
          relations: ['orders'],
        });
        orders = restaurants.map((restaurant) => restaurant.orders).flat(1);
        if (status) {
          orders = orders.filter((order) => order.status === status);
        }
      } else {
        return { ok: false, error: 'User not found.' };
      }
      return { ok: true, orders };
    } catch {
      return { ok: false, error: 'Could not get orders.' };
    }
  }

  canSeeOrder(user: User, order: Order): boolean {
    if (user.role === UserRole.Owner && order.restaurant?.ownerId !== user.id) {
      return false;
    }
    if (user.role === UserRole.Delivery && order.driver !== user) {
      return false;
    }
    if (user.role === UserRole.Client && order.customer !== user) {
      return false;
    }
    return true;
  }

  async getOrder(
    user: User,
    { id: orderId }: GetOrderInput,
  ): Promise<GetOrderOutput> {
    try {
      const order = await this.orders.findOne({
        where: { id: orderId },
        relations: ['restaurant'],
      });

      if (!order) {
        return { ok: false, error: 'Order not found.' };
      }
      const canSee = this.canSeeOrder(user, order);
      if (!canSee) {
        return { ok: false, error: 'You are not allowed to see this order.' };
      }
      return { ok: true, order };
    } catch {
      return { ok: false, error: 'Could not get order.' };
    }
  }

  async editOrder(
    user: User,
    { id: orderId, status }: EditOrderInput,
  ): Promise<EditOrderOutput> {
    try {
      const order = await this.orders.findOne({
        where: { id: orderId },
        relations: ['restaurant'],
      });
      if (!order) {
        return { ok: false, error: 'Order not found.' };
      }
      const canSee = this.canSeeOrder(user, order);
      if (!canSee) {
        return { ok: false, error: 'You are not allowed to edit this order.' };
      }
      let canEdit = true;
      if (user.role === UserRole.Client) {
        canEdit = false;
      }
      if (user.role === UserRole.Owner) {
        if (status !== OrderStatus.Cooked && status !== OrderStatus.Cooking) {
          canEdit = false;
        }
      }
      if (user.role === UserRole.Delivery) {
        if (
          status !== OrderStatus.PickedUp &&
          status != OrderStatus.Delivered
        ) {
          canEdit = false;
        }
      }
      if (!canEdit) {
        return { ok: false, error: 'You are not allowed to edit this order.' };
      }
      await this.orders.save({ id: orderId, status });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not edit order.' };
    }
  }
}
