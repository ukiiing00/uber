import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { CreateOrderInput, CreateOrderOutput } from './dto/create-order.dto';
import { User } from 'src/users/entities/user.entity';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from 'src/restaurants/entities/dish.entity';

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
}
