import { ArgsType, Field, ObjectType } from "@nestjs/graphql";
import { CoreOutput } from "src/common/dto/output.dto";
import { Category } from "../entities/category.entity";
import { Restaurant } from "../entities/restaurant.entity";
import { PaginationInput, PaginationOutput } from "./pagination.dto";

@ArgsType()
export class CategoryInput extends PaginationInput {
    @Field(type => String)
    slug: string;
}

@ObjectType()
export class CategoryOutput extends PaginationOutput {
    @Field(type => [Restaurant], { nullable: true })
    restaurants?: Restaurant[];
    @Field(type => Category, { nullable: true })
    category?: Category;
}

