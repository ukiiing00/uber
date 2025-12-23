import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { CreateAccountInput, CreateAccountOutput } from "./dto/create-account.dto";
import { LoginInput, LoginOutput } from "./dto/login.dto";
import { JwtService } from "src/jwt/jwt.service";
import { EditProfileInput } from "./dto/edit-profile.dto";
import { Verification } from "./entities/verification.entity";
import { VerifyEmailOutput } from "./dto/verify-email.dto";
import { UserProfileOutput } from "./dto/user-profile.dto";
import { MailService } from "src/mail/mail.service";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly users: Repository<User>,
        @InjectRepository(Verification)
        private readonly verifications: Repository<Verification>,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService
    ) {   }

    async createAccount({email, password, role}: CreateAccountInput): Promise<CreateAccountOutput> {
        try {
            const exists = await this.users.findOne({ where: { email } });
            console.log(exists);
            if (exists) {
                return { ok: false, error: 'There is a user with that email already' };
            }
            const user = this.users.create({ email, password, role });
            await this.users.save(user);
            const verification = this.verifications.create({
                user: user,
            });
            const savedVerification = await this.verifications.save(verification);
            this.mailService.sendVerificationEmail(email, savedVerification.code);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: 'Could not create account.' };
        }
    }

    async login({email, password}: LoginInput): Promise<LoginOutput> {
        try {
            const user = await this.users.findOne({ where: { email }, select: ['id', 'password'] });
            if (!user) {
                return { ok: false, error: 'User not found' };
            }
            const passwordCorrect = await user.checkPassword(password);
            console.log(passwordCorrect);
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
    
    async findById(id: number): Promise<UserProfileOutput> {
        try {
            const user = await this.users.findOne({ where: { id } });
            if (!user) {
                return { ok: false, error: 'User not found' };
            }
            return { ok: true, user };
        } catch (error) {
            return { ok: false, error : error.message };
        }
    }

    async editProfile(userId: number, editProfileInput: EditProfileInput): Promise<User> {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        if (editProfileInput.email) {
            user.email = editProfileInput.email;
            user.verified = false;
            
            // 기존 verification 삭제
            await this.verifications.delete({ user: { id: user.id } });
            
            // 새로운 verification 생성
            const verification = this.verifications.create({
                user: user,
            });
            await this.verifications.save(verification);
            // this.mailService.sendVerificationEmail(user.email, verification.code);
        }
        if (editProfileInput.password) {
            user.password = editProfileInput.password;
        }
        const updatedUser = this.users.merge(user, {...editProfileInput});
        return this.users.save(updatedUser);
    }

    async verifyEmail(code: string): Promise<VerifyEmailOutput> {
        const verification = await this.verifications.findOne({ where: { code } , relations: ['user'] });
        if (!verification) {
            return { ok: false, error: 'Verification not found.' };
        }
        verification.user.verified = true;
        await this.users.save(verification.user);
        await this.verifications.delete({id: verification.id});
        return { ok: true };
    }
}