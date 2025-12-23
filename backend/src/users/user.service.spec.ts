import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { Verification } from "./entities/verification.entity";
import { JwtService } from "src/jwt/jwt.service";
import { MailService } from "src/mail/mail.service";
import { ObjectLiteral, Repository } from "typeorm";

const mockRepository = () => ({
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    merge: jest.fn(),
});

const mockJwtService = {
    sign: jest.fn((payload: any) => 'token'),
    verify: jest.fn(),
}

const mockMailService = {
    sendVerificationEmail: jest.fn(),
}

type MockRepository<T extends ObjectLiteral = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('UsersService', () => {
    let service : UsersService;
    let usersRepository : MockRepository<User>;
    let verificationsRepository : MockRepository<Verification>;
    let mailService : MailService;
    let jwtService : JwtService;

    beforeEach(async () => {
        const module : TestingModule =  await Test.createTestingModule({
            providers: [UsersService,{
                provide: getRepositoryToken(User),
                useValue: mockRepository(),
            },
            {
                provide: getRepositoryToken(Verification),
                useValue: mockRepository(),
            },
            {
                provide: JwtService,
                useValue: mockJwtService,
            },
            {
                provide: MailService,
                useValue: mockMailService,
            },
        ],
        }).compile();
        service = module.get<UsersService>(UsersService);        
        usersRepository = module.get(getRepositoryToken(User));
        verificationsRepository = module.get(getRepositoryToken(Verification));
        mailService = module.get(MailService);
        jwtService = module.get(JwtService);
    })

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('createAccount', () => {{
        const createAccountArgs = {
            email: 'test@test.com',
            password: 'password',
            role: 0,
        }
        it('should fail if user exists', async () => {
            usersRepository.findOne!.mockResolvedValue({ id: 1, email: createAccountArgs.email });
            const result = await service.createAccount(createAccountArgs);
            expect(result).toMatchObject({ ok: false, error: 'There is a user with that email already' });
        });
        it('should create a new user', async () => {
            usersRepository.findOne!.mockResolvedValue(null);
            usersRepository.create!.mockReturnValue(createAccountArgs);
            verificationsRepository.create!.mockReturnValue({ user: createAccountArgs });
            verificationsRepository.save!.mockResolvedValue({ code: 'code' });
            const result = await service.createAccount(createAccountArgs);
            expect(usersRepository.create).toHaveBeenCalledTimes(1);
            expect(usersRepository.create).toHaveBeenCalledWith(createAccountArgs);
            expect(usersRepository.save).toHaveBeenCalledTimes(1);
            expect(usersRepository.save).toHaveBeenCalledWith(createAccountArgs);
            expect(verificationsRepository.create).toHaveBeenCalledTimes(1);
            expect(verificationsRepository.create).toHaveBeenCalledWith({ user: createAccountArgs });
            expect(verificationsRepository.save).toHaveBeenCalledTimes(1);
            expect(verificationsRepository.save).toHaveBeenCalledWith({ user: createAccountArgs });
            expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
            expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(expect.any(String), expect.any(String));
            expect(result).toMatchObject({ ok: true });
        });

        it('should fail on exception', async () => {
            usersRepository.findOne!.mockRejectedValue(new Error('User not found'));
            const result = await service.createAccount(createAccountArgs);
            expect(result).toMatchObject({ ok: false, error: 'Could not create account.' });
        });    
    }
        
    });

    describe('login', () => {
        const loginArgs = {
            email: 'test@test.com',
            password: 'password',
        }
        it('should fail if user not found', async () => {
            usersRepository.findOne!.mockResolvedValue(null);
            const result = await service.login(loginArgs);
            expect(usersRepository.findOne).toHaveBeenCalledTimes(1);
            expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { email: loginArgs.email }, select: ['id', 'password'] });
            expect(result).toMatchObject({ ok: false, error: 'User not found' });
        });

        it('should fail if password is incorrect', async () => {
            const mockedUser = {
                id: 1,
                checkPassword: jest.fn(()=> Promise.resolve(false)),
            }
            usersRepository.findOne!.mockResolvedValue(mockedUser);
            const result = await service.login(loginArgs);
            expect(result).toMatchObject({ ok: false, error: 'Wrong password' });
        });
        it('should return token if login is successful', async () => {
            const mockedUser = {
                id: 1,
                checkPassword: jest.fn(()=> Promise.resolve(true)),
            }
            usersRepository.findOne!.mockResolvedValue(mockedUser);
            const result = await service.login(loginArgs);
            expect(jwtService.sign).toHaveBeenCalledTimes(1);
            expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Object));
            expect(result).toMatchObject({ ok: true, token: 'token' });
        });
    });


    describe('findById', () => {
        
        it('should fail if user not found', async () => {
            usersRepository.findOne!.mockResolvedValue(null);
            const result = await service.findById(1);
            expect(result).toMatchObject({ ok: false, error: 'User not found' });
        });
        it('should return user if found', async () => {
            const mockedUser = {
                id: 1,
                email: 'test@test.com',
            }
            usersRepository.findOne!.mockResolvedValue(mockedUser);
            const result = await service.findById(1);
            expect(result).toMatchObject({ ok: true, user: mockedUser });
        });

        it('should fail on exception', async () => {
            usersRepository.findOne!.mockRejectedValue(new Error('Could not find user.'));
            const result = await service.findById(1);
            expect(result).toMatchObject({ ok: false, error: 'Could not find user.' });
        });
    });
    it.todo('editProfile');
    it.todo('verifyEmail');
});

