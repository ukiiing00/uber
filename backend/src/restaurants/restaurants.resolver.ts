import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { Restaurant } from "./entities/restaurant.entity";
import { CreateRestaurantDto } from "./dto/create-restaurant.dto";

@Resolver(() => Restaurant)
export class RestaurantsResolver {
    @Query(() => [Restaurant])
    restaurants(@Args('veganOnly') veganOnly: boolean): Restaurant[] {
        return [];
    }
    @Mutation(() => Boolean)
    createRestaurant(@Args() createRestaurantDto: CreateRestaurantDto): boolean {
        console.log(createRestaurantDto);
        return true;
    }
}