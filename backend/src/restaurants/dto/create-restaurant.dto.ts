import { ArgsType, Field } from "@nestjs/graphql";
import { IsString, Length } from "class-validator";

@ArgsType()
export class CreateRestaurantDto {
    @Field(() => String)
    @IsString()
    @Length(5, 10)
    name: string;

    @Field(() => Boolean)
    isVegan: boolean;

    @Field(() => String)
    address: string;

    @Field(() => String)
    ownerName: string;
}