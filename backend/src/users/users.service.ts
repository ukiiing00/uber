import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { CreateAccountInput, CreateAccountOutput } from "./dto/create-account.dto";
import { LoginInput, LoginOutput } from "./dto/login.dto";
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from "@nestjs/config";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,
        private readonly config: ConfigService
    ) {}

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
            const token = jwt.sign(
                { id: user.id }, 
                this.config.get<string>('SECRET_KEY')!,
                { expiresIn: '1h' }
            );
            return { ok: true, token };
        } catch (error) {
            return { ok: false, error: 'Could not login.' };
        }
    }
    
}