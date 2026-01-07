/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant } from './entities/restaurant.entity';
import { Like, Repository } from 'typeorm';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dto/create-restaurant.dto';
import { User } from 'src/users/entities/user.entity';
import { Category } from './entities/category.entity';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dto/edit-restaurant.dto';
import { CategoryRepository } from './repositories/category.repository';
import {
  DeleteRestaurantInput,
  DeleteRestaurantOutput,
} from './dto/delete-restaurant.dto';
import { AllCategoriesOutput } from './dto/all-categories.dto';
import { CategoryInput, CategoryOutput } from './dto/category.dto';
import { RestaurantsInput, RestaurantsOutput } from './dto/restaurants.dto';
import { RestaurantInput, RestaurantOutput } from './dto/restaurant.dto';
import { SearchRestaurantInput, SearchRestaurantOutput } from './dto/search-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant) // get the repository of the Restaurant entity
    private readonly restaurant: Repository<Restaurant>, // repository of the Restaurant entity
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly categories: CategoryRepository, // repository of the Category entity
  ) {}

  async createRestaurant(
    owner: User,
    createRestaurantInput: CreateRestaurantInput,
  ): Promise<CreateRestaurantOutput> {
    try {
      const newRestaurant = this.restaurant.create(createRestaurantInput);
      newRestaurant.owner = owner;
      const category = await this.categories.getOrCreate(
        createRestaurantInput.categoryName,
      );
      newRestaurant.category = category;
      await this.restaurant.save(newRestaurant);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'Could not create restaurant.' };
    }
  }

  async editRestaurant(
    owner: User,
    _editRestaurantInput: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    const restaurant = await this.restaurant.findOne({
      where: { id: _editRestaurantInput.restaurantId },
      loadEagerRelations: true,
    });
    if (!restaurant) {
      return { ok: false, error: 'Restaurant not found.' };
    }
    if (restaurant.ownerId !== owner.id) {
      return {
        ok: false,
        error: 'You are not allowed to edit this restaurant.',
      };
    }
    let category: Category | undefined;
    if (_editRestaurantInput.categoryName) {
      category = await this.categories.getOrCreate(
        _editRestaurantInput.categoryName,
      );
    }
    await this.restaurant.save({
      id: _editRestaurantInput.restaurantId,
      ..._editRestaurantInput,
      ...(category && { category }),
    });
    return { ok: true };
  }

  async deleteRestaurant(
    owner: User,
    deleteRestaurantInput: DeleteRestaurantInput,
  ): Promise<DeleteRestaurantOutput> {
    const restaurant = await this.restaurant.findOne({
      where: { id: deleteRestaurantInput.restaurantId },
      loadEagerRelations: true,
    });
    if (!restaurant) {
      return { ok: false, error: 'Restaurant not found.' };
    }
    if (restaurant.ownerId !== owner.id) {
      return {
        ok: false,
        error: 'You are not allowed to delete this restaurant.',
      };
    }
    await this.restaurant.delete(restaurant.id);
    return { ok: true };
  }

  async allCategories(): Promise<AllCategoriesOutput> {
    try {
      const categories = await this.categoryRepo.find();
      return { ok: true, categories };
    } catch (error) {
      return { ok: false, error: 'Could not load categories.' };
    }
  }
  countRestaurants(category: Category) {
    return this.restaurant.count({ where: { category: { id: category.id } } });
  }

  async findCategoryBySlug({slug, page}: CategoryInput): Promise<CategoryOutput> {
    try{
      const category = await this.categoryRepo.findOne({
        where: { slug },
      });
      if (!category) {
        return { ok: false, error: 'Category not found.' };
      }
      const restaurants = await this.restaurant.find({
        where: { category: { id: category.id } },
        skip: (page - 1) * 25,
        take: 25,
      });
      const totalResults = await this.countRestaurants(category)
      return { ok: true, restaurants, category, totalPages: Math.ceil(totalResults / 25) };
    } catch (error) {
      return { ok: false, error: 'Could not load category.' };
    }
  }


  async allRestaurants({page}: RestaurantsInput): Promise<RestaurantsOutput> {
    try{
      const [restaurants, totalResults] = await this.restaurant.findAndCount({
        skip: (page - 1) * 25,
        take: 25,
      });
      return { ok: true, results: restaurants, totalResults: totalResults, totalPages: Math.ceil(totalResults / 25) };
    } catch (error) {
      return { ok: false, error: 'Could not load restaurants.' };
    }
  }

  async findRestaurantById({restaurantId}: RestaurantInput): Promise<RestaurantOutput> {
    try{
      const restaurant = await this.restaurant.findOne({ where: { id: restaurantId } });
      if (!restaurant) {
        return { ok: false, error: 'Restaurant not found.'};

      }
      return { ok: true, restaurant: restaurant };
    } catch (error) {
      return { ok: false, error: 'Could not load restaurant.'};
    }
  }

  async searchRestaurantByName({query, page}: SearchRestaurantInput): Promise<SearchRestaurantOutput> {
    try{
      const [restaurants, totalResults] = await this.restaurant.findAndCount({
        where: { name: Like(`%${query}%`) },
        skip: (page - 1) * 25,
        take: 25,
      });
      return { ok: true, restaurants, totalResults: totalResults, totalPages: Math.ceil(totalResults / 25) };
    } catch (error) {
      return { ok: false, error: 'Could not search restaurants.' };
    }
  }
}

