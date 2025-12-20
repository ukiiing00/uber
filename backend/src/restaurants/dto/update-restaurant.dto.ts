import { Field, InputType, PartialType } from "@nestjs/graphql";
import { CreateRestaurantDto } from "./create-restaurant.dto";

@InputType()
export class UpdateRestaurantInputType extends PartialType(CreateRestaurantDto) {} // Optional fields

@InputType()
export class UpdateRestaurantDto {
    @Field(() => Number)
    id: number; // Required field
    @Field(() => UpdateRestaurantInputType)
    data: UpdateRestaurantInputType; // Optional fields
}