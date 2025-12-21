import { Field, InputType, ObjectType, registerEnumType } from "@nestjs/graphql";
import { CoreEntity } from "src/common/entities/core.entity";
import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import * as bcrypt from 'bcrypt';

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
    email: string;

    @Column()
    @Field(() => String) 
    password: string;

    @Column({ type: 'enum', enum: UserRole }) 
    @Field(() => UserRole)
    role : UserRole;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword(): Promise<void> {
        this.password = await bcrypt.hash(this.password, 10);
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