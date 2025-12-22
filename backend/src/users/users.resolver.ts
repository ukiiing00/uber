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
import { VerifyEmailInput, VerifyEmailOutput } from "./dto/verify-email.dto";


@Resolver(of => User)
export class UsersResolver {
    constructor(private readonly usersService: UsersService) {}

    @Query(() => Boolean)
    hi() {
        return true;
    }
    @Mutation(() => CreateAccountOutput)
    async createUser(@Args('input') CreateAccountInput: CreateAccountInput): Promise<CreateAccountOutput> {
        return this.usersService.createAccount(CreateAccountInput);
    }

    @Mutation(() => LoginOutput)
    login(@Args('input') loginInput: LoginInput): Promise<LoginOutput> {
        return this.usersService.login(loginInput);
    }
    @Query(() => User)
    @UseGuards(AuthGuard) // this guard will check if the user is authenticated
    me(@AuthUser() user: User) {
        return user;
    }


    @Query(() => UserProfileOutput)
    @UseGuards(AuthGuard)
    async userProfile(@Args() userProfileInput: UserProfileInput): Promise<UserProfileOutput> {
        return this.usersService.findById(userProfileInput.userId);
    }

    @Mutation(() => EditProfileOutput)
    @UseGuards(AuthGuard)   
    async editProfile(@AuthUser() user: User, @Args('input') editProfileInput: EditProfileInput) {
        return this.usersService.editProfile(user.id, editProfileInput);
    }

    @Mutation(() => VerifyEmailOutput)
    async verifyEmail(@Args('input') verifyEmailInput: VerifyEmailInput) {
        return this.usersService.verifyEmail(verifyEmailInput.code);
    }

}