import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { CreateAccountInput, CreateAccountOutput } from "./dto/create-account.dto";
import { LoginInput, LoginOutput } from "./dto/login.dto";
import * as jwt from 'jsonwebtoken';
import { ConfigService } from "@nestjs/config";
import { JwtService } from "src/jwt/jwt.service";
import { EditProfileInput, EditProfileOutput } from "./dto/edit-profile.dto";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,
        private readonly jwtService: JwtService
    ) {   }

    async createAccount({email, password, role}: CreateAccountInput): Promise<CreateAccountOutput> {
        try {
            const exists = await this.users.findOne({ where: { email } });
            if (exists) {
                return { ok: false, error: 'There is a user with that email already' };
            }
            const user = this.users.create({ email, password, role });
            await this.users.save(user);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: 'Could not create account.' };
        }
    }

    async login({email, password}: LoginInput): Promise<LoginOutput> {
        try {
            const user = await this.users.findOne({ where: { email } });
            if (!user) {
                return { ok: false, error: 'User not found' };
            }
            const passwordCorrect = await user.checkPassword(password);
            if (!passwordCorrect) {
                return { ok: false, error: 'Wrong password' };
            }
            const token = this.jwtService.sign(
                { id: user.id }
            );
            return { ok: true, token };
        } catch (error) {
            return { ok: false, error: 'Could not login.' };
        }
    }
    
    async findById(id: number): Promise<User | null> {
        return  this.users.findOne({ where: { id } });
    }

    async editProfile(userId: number, editProfileInput: EditProfileInput) {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        return this.users.save(this.users.merge(user, {...editProfileInput}));
    }
}