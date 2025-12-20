import { Field, InputType, ObjectType } from "@nestjs/graphql";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@InputType({ isAbstract: true })
@ObjectType()
@Entity()
export class Restaurant {

    @PrimaryGeneratedColumn()
    @Field(() => Number)
    id: number;
    
    @Field(() => String!)
    @Column()
    name: string;

    @Field(() => Boolean, {defaultValue: true})
    @Column({default: true})
    @IsOptional()
    @IsBoolean()
    isVegan: boolean;

    @Field(() => String)
    @Column()
    @IsString()
    address: string;

    @Field(() => String)
    @Column()
    @IsString()
    ownerName: string;

    @Field(() => String)
    @Column()
    @IsString()
    categoryName: string;

}