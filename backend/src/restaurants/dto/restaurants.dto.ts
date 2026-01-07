import { ArgsType, Field, InputType, Int, ObjectType } from "@nestjs/graphql";
import { Restaurant } from "../entities/restaurant.entity";
import { PaginationInput, PaginationOutput } from "./pagination.dto";

@ArgsType()
export class RestaurantsInput extends PaginationInput {}


@ObjectType()
export class RestaurantsOutput extends PaginationOutput {   
    @Field(type => [Restaurant], { nullable: true })
    results?: Restaurant[];
}