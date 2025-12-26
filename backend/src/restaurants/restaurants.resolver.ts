import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { Restaurant } from "./entities/restaurant.entity";
import { CreateRestaurantInput, CreateRestaurantOutput } from "./dto/create-restaurant.dto";
import { RestaurantsService } from "./restaurants.service";
import { AuthUser } from "src/auth/auth-user.decorator";
import { User } from "src/users/entities/user.entity";
import { Role } from "src/auth/role.decorator";
import { EditRestaurantInput, EditRestaurantOutput } from "./dto/edit-restaurant.dto";

@Resolver(() => Restaurant)
export class RestaurantsResolver {
    constructor(private readonly restaurantsService: RestaurantsService) {}
    @Mutation(() => CreateRestaurantOutput)
    @Role(['Owner'])
    createRestaurant(
        @AuthUser() authUser: User,
        @Args('input') createRestaurantInput: CreateRestaurantInput,): Promise<CreateRestaurantOutput> {
        return this.restaurantsService.createRestaurant(authUser, createRestaurantInput); 
    }

    @Mutation(() => EditRestaurantOutput)
    @Role(['Owner'])
    editRestaurant(
        @AuthUser() authUser: User,
        @Args('input') editRestaurantInput: EditRestaurantInput,
    ) {
        return {ok: true}
    }
}