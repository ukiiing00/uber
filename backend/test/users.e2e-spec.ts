/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Verification } from 'src/users/entities/verification.entity';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'ukiiing@uk.com',
  password: 'password',
};
describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  let usersRepository: Repository<User>;
  let verificationRepository: Repository<Verification>;

  const baseTest = () => request(app.getHttpServer()).post(GRAPHQL_ENDPOINT);
  const publicTest = (query: string) => baseTest().send({ query });
  const privateTest = (query: string) =>
    baseTest().set('X-JWT', jwtToken).send({ query });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verificationRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification),
    );
    await app.init();
  });

  afterAll(async () => {
    const dataSource = app.get(DataSource);
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('createAccount', () => {
    it('should create account', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
          mutation {
            createAccount(input: {
              email:"${testUser.email}",
              password:"${testUser.password}",
              role:Client
            }) {
              ok
              error
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data?.createAccount.ok).toBe(true);
          expect(res.body.data?.createAccount.error).toBe(null);
        });
    });

    it('should fail if account already exists', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
          mutation {
            createAccount(input: { email: "${testUser.email}", password: "${testUser.password}", role: Client }) {
              ok
              error
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data?.createAccount.ok).toBe(false);
          expect(res.body.data?.createAccount.error).toBe(
            'There is a user with that email already',
          );
        });
    });
  });

  describe('login', () => {
    it('should login with correct credentials', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation {
          login(input: { email: "${testUser.email}", password: "${testUser.password}" }) {
            ok
            error
            token
          }
        } 
        `,
        })
        .expect(200)
        .expect((res) => {
          const { login } = res.body.data;
          expect(login.ok).toBe(true);
          expect(login.error).toBe(null);
          expect(login.token).toBeDefined();
          jwtToken = login.token;
        });
    });

    it('should not be able to login with wrong credentials', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
          mutation {
            login(input: { email: "${testUser.email}", password: "wrongpassword" }) {
              ok
              error
              token
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { login } = res.body.data;
          expect(login.ok).toBe(false);
          expect(login.error).toBe('Wrong password');
          expect(login.token).toBeNull();
        });
    });
  });

  describe('userProfile', () => {
    let userId: number;
    beforeAll(async () => {
      const user = await usersRepository.findOne({
        where: { email: testUser.email },
        select: ['id'],
      });
      if (!user) {
        throw new Error('User not found');
      }
      userId = user.id;
    });
    it('should return user profile', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          {
            userProfile(userId: ${userId}) {
              ok
              error
              user {
                id
              }
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { userProfile } = res.body.data;
          expect(userProfile.ok).toBe(true);
          expect(userProfile.error).toBe(null);
          expect(userProfile.user).toBeDefined();
          expect(userProfile.user.id).toBe(userId);
        });
    });
    it('should fail if user not found', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          {
            userProfile(userId: 666) {
              ok
              error
              user {
                id
              }
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { userProfile } = res.body.data;
          expect(userProfile.ok).toBe(false);
          expect(userProfile.error).toBe('User not found');
          expect(userProfile.user).toBeNull();
        });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          {
            me {
              id
              email
              role
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { me } = res.body.data;
          expect(me.email).toBe(testUser.email);
          expect(me.role).toBe('Client');
        });
    });
    it('should not allow logged out user', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
          {
            me {
              id
              email
              role
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { errors } = res.body;
          expect(errors).toBeDefined();
          expect(errors[0].message).toBe('Forbidden resource');
        });
    });
  });
  describe('editProfile', () => {
    const newEmail = 'newemail@new.com';
    const newPassword = 'newpassword';
    it('should change email', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          mutation {
            editProfile(input: { email: "${newEmail}" }) {
              ok
              error
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { editProfile } = res.body.data;
          expect(editProfile.ok).toBe(true);
          expect(editProfile.error).toBe(null);
        });
    });
    it('should have new email in the database', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          {
            me {
              email
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { me } = res.body.data;
          expect(me.email).toBe(newEmail);
        });
    });
    it('should change password', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          mutation {
            editProfile(input: { password: "${newPassword}" }) {
              ok
              error
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { editProfile } = res.body.data;
          expect(editProfile.ok).toBe(true);
          expect(editProfile.error).toBe(null);
        });
    });
    it('should have new password in the database', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('x-jwt', jwtToken)
        .send({
          query: `
          mutation {
            login(input: { email: "${newEmail}", password: "${newPassword}" }) {
              ok
              error
              token
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { login } = res.body.data;
          expect(login.ok).toBe(true);
          expect(login.error).toBe(null);
          expect(login.token).toBeDefined();
        });
    });
  });
  describe('verifyEmail', () => {
    let verificationCode: string;
    beforeAll(async () => {
      const verification = await verificationRepository.find();
      if (!verification) {
        throw new Error('Verification not found');
      }
      verificationCode = verification[0].code;
    });
    it('should verify email', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
          mutation {
            verifyEmail(input: { code: "${verificationCode}" }) {
              ok
              error
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { verifyEmail } = res.body.data;
          expect(verifyEmail.ok).toBe(true);
          expect(verifyEmail.error).toBe(null);
        });
    });
    it('should not verify email with wrong code', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
          mutation {
            verifyEmail(input: { code: "wrongcode" }) {
              ok
              error
            }
          }
          `,
        })
        .expect(200)
        .expect((res) => {
          const { verifyEmail } = res.body.data;
          expect(verifyEmail.ok).toBe(false);
          expect(verifyEmail.error).toBe('Verification not found.');
        });
    });
  });
});
