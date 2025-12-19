import { Restaurant } from "./entities/restaurant.entity";
import { CreateRestaurantDto } from "./dto/create-restaurant.dto";
export declare class RestaurantsResolver {
    restaurants(veganOnly: boolean): Restaurant[];
    createRestaurant(createRestaurantDto: CreateRestaurantDto): boolean;
}
