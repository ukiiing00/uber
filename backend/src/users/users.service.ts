import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { CreateAccountInput, CreateAccountOutput } from "./dto/create-account.dto";
import { LoginInput, LoginOutput } from "./dto/login.dto";
import { JwtService } from "src/jwt/jwt.service";
import { EditProfileInput, EditProfileOutput } from "./dto/edit-profile.dto";
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

    async editProfile(userId: number, editProfileInput: EditProfileInput): Promise<EditProfileOutput> {
       try {
        const user = await this.users.findOne({ where: { id: userId } });
        console.log(user);
        if (!user) {
            return { ok: false, error: 'User not found' };
        }
        
        // email 변경 시 verification 재생성
        if (editProfileInput.email) {
            user.verified = false;
            await this.verifications.delete({ user: { id: user.id } });
            const verification = this.verifications.create({ user });
            await this.verifications.save(verification);
            await this.mailService.sendVerificationEmail(editProfileInput.email, verification.code);
        }
        
        // 모든 필드를 merge로 업데이트 (email, password 포함)
        const mergedUser = this.users.merge(user, editProfileInput);
        await this.users.save(mergedUser);
        return { ok: true };
       } catch (error) {
        return { ok: false, error: error.message };
       }
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