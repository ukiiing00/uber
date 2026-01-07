/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Restaurant } from './entities/restaurant.entity';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dto/create-restaurant.dto';
import { RestaurantsService } from './restaurants.service';
import { AuthUser } from 'src/auth/auth-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { Role } from 'src/auth/role.decorator';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dto/edit-restaurant.dto';
import {
  DeleteRestaurantInput,
  DeleteRestaurantOutput,
} from './dto/delete-restaurant.dto';
import { AllCategoriesOutput } from './dto/all-categories.dto';
import { Category } from './entities/category.entity';
import { CategoryInput, CategoryOutput } from './dto/category.dto';
import { RestaurantsInput, RestaurantsOutput } from './dto/restaurants.dto';
import { RestaurantInput, RestaurantOutput } from './dto/restaurant.dto';
import { SearchRestaurantInput, SearchRestaurantOutput } from './dto/search-restaurant.dto';

@Resolver(() => Restaurant)
export class RestaurantsResolver {
  constructor(private readonly restaurantsService: RestaurantsService) {}
  @Mutation(() => CreateRestaurantOutput)
  @Role(['Owner'])
  createRestaurant(
    @AuthUser() authUser: User,
    @Args('input') createRestaurantInput: CreateRestaurantInput,
  ): Promise<CreateRestaurantOutput> {
    return this.restaurantsService.createRestaurant(
      authUser,
      createRestaurantInput,
    );
  }

  @Mutation(() => EditRestaurantOutput)
  @Role(['Owner'])
  editRestaurant(
    @AuthUser() owner: User,
    @Args('input') editRestaurantInput: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    return this.restaurantsService.editRestaurant(owner, editRestaurantInput);
  }

  @Mutation(() => DeleteRestaurantOutput)
  @Role(['Owner'])
  deleteRestaurant(
    @AuthUser() owner: User,
    @Args('input') deleteRestaurantInput: DeleteRestaurantInput,
  ): Promise<DeleteRestaurantOutput> {
    return this.restaurantsService.deleteRestaurant(
      owner,
      deleteRestaurantInput,
    );
  }
  @Query(() => RestaurantsOutput)
  restaurants(@Args() restaurantsInput: RestaurantsInput): Promise<RestaurantsOutput> {
    return this.restaurantsService.allRestaurants(restaurantsInput);
  }
  @Query(() => RestaurantOutput)
  restaurant(@Args() restaurantInput: RestaurantInput): Promise<RestaurantOutput> {
    return this.restaurantsService.findRestaurantById(restaurantInput);
  }
  @Query(() => SearchRestaurantOutput)
  searchRestaurant(@Args() searchRestaurantInput: SearchRestaurantInput): Promise<SearchRestaurantOutput> {
    return this.restaurantsService.searchRestaurantByName(searchRestaurantInput);
  }
}

@Resolver((of) => Category)
export class CategoriesResolver {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @ResolveField(() => Number)
  restaurantCount(@Parent() category: Category): Promise<number> {
    // the reason why we use Promise<number> is because the countRestaurants method is async
    // we don't use await because browser will wait for the promise to resolve before rendering the page
    return this.restaurantsService.countRestaurants(category);
  }

  @Query(() => AllCategoriesOutput)
  allCategories(): Promise<AllCategoriesOutput> {
    return this.restaurantsService.allCategories();
  }

  @Query(() => CategoryOutput)
  category(@Args() categoryInput: CategoryInput): Promise<CategoryOutput> {
    return this.restaurantsService.findCategoryBySlug(categoryInput);
  }
}
