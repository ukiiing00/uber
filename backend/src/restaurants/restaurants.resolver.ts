import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { Restaurant } from "./entities/restaurant.entity";
import { CreateRestaurantDto } from "./dto/create-restaurant.dto";
import { RestaurantsService } from "./restaurants.service";
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto";

@Resolver(() => Restaurant)
export class RestaurantsResolver {
    constructor(private readonly restaurantsService: RestaurantsService) {}
    @Query(() => [Restaurant])
    restaurants(): Promise<Restaurant[]> {
        return this.restaurantsService.getAll();
    }
    @Mutation(() => Boolean)
    async createRestaurant(@Args('input') createRestaurantDto: CreateRestaurantDto,): Promise<boolean> {
        try {
            await this.restaurantsService.createRestaurant(createRestaurantDto);
            return true;
        }catch (error) {
            console.log(error);
            return false;
        }
    }
    @Mutation(() => Boolean)
    async updateRestaurant(@Args('input') updateRestaurantDto: UpdateRestaurantDto) {
    try {
        await this.restaurantsService.updateRestuarant(updateRestaurantDto);
        return true;
    }catch (error) {
        console.log(error);
        return false;
    }
    }

}