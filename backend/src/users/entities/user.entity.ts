import { Field, InputType, ObjectType, registerEnumType } from "@nestjs/graphql";
import { CoreEntity } from "src/common/entities/core.entity";
import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import * as bcrypt from 'bcrypt';
import { InternalServerErrorException } from "@nestjs/common";
import { IsEmail } from "class-validator";

enum UserRole {
    Client = 'client',
    Owner = 'owner',
    Delivery = 'delivery',
}

registerEnumType(UserRole, {
    name: 'UserRole',
});

@InputType({ isAbstract: true })
@ObjectType()
@Entity()
export class User extends CoreEntity { 

    @Column()
    @Field(() => String)
    @IsEmail()
    email: string;

    @Column({ select: false })
    @Field(() => String) 
    password: string;

    @Column({ type: 'enum', enum: UserRole }) 
    @Field(() => UserRole)
    role : UserRole;

    
    @Column({ default: false })
    @Field(() => Boolean)
    verified: boolean;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword(): Promise<void> {
        if (this.password) {
           try {
                this.password = await bcrypt.hash(this.password, 10);
            } catch (error) {
                console.log(error);
                throw new InternalServerErrorException();
            }
        }       
    }

    async checkPassword(aPassword: string): Promise<boolean> {
        try {
            return await bcrypt.compare(aPassword, this.password);
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}