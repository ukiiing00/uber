import { Resolver, Query, Mutation, Args, Context } from "@nestjs/graphql";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { CreateAccountInput, CreateAccountOutput } from "./dto/create-account.dto";
import { LoginInput, LoginOutput } from "./dto/login.dto";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/auth/auth.guard";
import { AuthUser } from "src/auth/auth-user.decorator";
import { UserProfileInput, UserProfileOutput } from "./dto/user-profile.dto";
import { EditProfileInput, EditProfileOutput } from "./dto/edit-profile.dto";


@Resolver(of => User)
export class UsersResolver {
    constructor(private readonly usersService: UsersService) {}

    @Query(() => Boolean)
    hi() {
        return true;
    }
    @Mutation(() => CreateAccountOutput)
    async createUser(@Args('input') CreateAccountInput: CreateAccountInput): Promise<CreateAccountOutput> {
        try {
            const {ok, error} = await this.usersService.createAccount(CreateAccountInput);
            if (!ok) {
                return { ok, error };
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, error: 'Could not create account.' };
        }
    }

    @Mutation(() => LoginOutput)
    async login(@Args('input') loginInput: LoginInput): Promise<LoginOutput> {
        try {
            const {ok, error, token} = await this.usersService.login(loginInput);
            if (!ok) {
                return { ok, error };
            }
            return { ok: true, token };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }
    @Query(() => User)
    @UseGuards(AuthGuard) // this guard will check if the user is authenticated
    me(@AuthUser() user: User) {
        return user;
    }


    @Query(() => UserProfileOutput)
    @UseGuards(AuthGuard)
    async userProfile(@Args() userProfileInput: UserProfileInput): Promise<UserProfileOutput> {
        try {
            const user = await this.usersService.findById(userProfileInput.userId);
            if (!user) {
                return { ok: false, error: 'User not found' };
            }
            return { ok: true, user };
        } catch (error) {
            return { ok: false, error: 'Could not load user.' };
        }
    }

    @Mutation(() => EditProfileOutput)
    @UseGuards(AuthGuard)   
    async editProfile(@AuthUser() user: User, @Args('input') editProfileInput: EditProfileInput) {
        try {
            console.log(user.id, editProfileInput);
            await this.usersService.editProfile(user.id, editProfileInput);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: 'Could not edit profile.' };
        }
    }
}