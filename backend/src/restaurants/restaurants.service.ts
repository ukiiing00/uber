import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Restaurant } from "./entities/restaurant.entity";
import { Repository } from "typeorm";
import { CreateRestaurantDto } from "./dto/create-restaurant.dto";
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto";

@Injectable()
export class RestaurantsService {
    constructor(
        @InjectRepository(Restaurant) // get the repository of the Restaurant entity
        private readonly restaurant: Repository<Restaurant> // repository of the Restaurant entity
    ) {}
    getAll(): Promise<Restaurant[]> {
        return this.restaurant.find();
    }
    createRestaurant(createRestaurantDto: CreateRestaurantDto): Promise<Restaurant> {
        const newRestaurant = this.restaurant.create(createRestaurantDto);
        return this.restaurant.save(newRestaurant);
    }
    updateRestuarant({id, data}: UpdateRestaurantDto) {
         return this.restaurant.update(id, {...data});
    }
}

