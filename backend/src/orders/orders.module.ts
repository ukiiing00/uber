import { Module } from '@nestjs/common';
import { OrderResolver } from './orders.resolver';
import { OrderService } from './orders.service';
import { Order } from './entities/order.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from 'src/restaurants/entities/dish.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Restaurant, OrderItem, Dish])],
  providers: [OrderService, OrderResolver],
})
export class OrdersModule {}
