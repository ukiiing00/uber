# TypeORM Select 옵션

## 개요

`select` 옵션을 사용하면 엔티티의 특정 필드를 기본 조회에서 제외할 수 있습니다. 주로 민감한 정보(password, token 등)를 보호하기 위해 사용합니다.

## 기본 사용법

### Entity 정의

```typescript
@Entity()
export class User {
    @Column()
    @Field(() => String)
    email: string;

    @Column({ select: false })  // 기본 조회에서 제외
    @Field(() => String)
    password: string;

    @Column()
    @Field(() => String)
    name: string;
}
```

### 일반 조회 (password 제외)

```typescript
// password는 조회되지 않음
const user = await users.findOne({ where: { id: 1 } });
console.log(user);
// { id: 1, email: 'test@test.com', name: 'John', password: undefined }
```

### 명시적으로 포함하기

```typescript
// password를 포함하려면 명시적으로 select 지정
const user = await users.findOne({ 
    where: { id: 1 },
    select: ['id', 'email', 'password', 'name']  // password 명시
});
console.log(user);
// { id: 1, email: 'test@test.com', name: 'John', password: 'hashed...' }
```

## 실전 예시

### User Entity with Password

```typescript
@Entity()
export class User extends CoreEntity {
    @Column()
    @Field(() => String)
    email: string;

    @Column({ select: false })  // 기본 조회에서 제외
    @Field(() => String)
    password: string;

    @Column({ type: 'enum', enum: UserRole })
    @Field(() => UserRole)
    role: UserRole;

    @Column({ default: false })
    @Field(() => Boolean)
    verified: boolean;
}
```

### 회원가입 (password 불필요)

```typescript
async createAccount({ email, password, role }: CreateAccountInput) {
    const exists = await this.users.findOne({ where: { email } });
    // password는 자동으로 제외됨 (select: false)
    
    if (exists) {
        return { ok: false, error: 'User exists' };
    }
    
    const user = this.users.create({ email, password, role });
    await this.users.save(user);
    return { ok: true };
}
```

### 로그인 (password 필요)

```typescript
async login({ email, password }: LoginInput) {
    // password가 필요하므로 명시적으로 select
    const user = await this.users.findOne({ 
        where: { email },
        select: ['id', 'email', 'password', 'role', 'verified']
    });
    
    if (!user) {
        return { ok: false, error: 'User not found' };
    }
    
    const passwordCorrect = await user.checkPassword(password);
    if (!passwordCorrect) {
        return { ok: false, error: 'Wrong password' };
    }
    
    const token = this.jwtService.sign({ id: user.id });
    return { ok: true, token };
}
```

### 프로필 조회 (password 불필요)

```typescript
async findById(id: number): Promise<User | null> {
    // password는 자동으로 제외됨
    return this.users.findOne({ where: { id } });
}
```

### 프로필 수정 (password 포함)

```typescript
async editProfile(userId: number, editProfileInput: EditProfileInput) {
    // password 변경 가능성이 있으므로 포함
    const user = await this.users.findOne({ 
        where: { id: userId },
        select: ['id', 'email', 'password', 'role', 'verified']
    });
    
    if (!user) {
        throw new Error('User not found');
    }
    
    if (editProfileInput.email) {
        user.email = editProfileInput.email;
        user.verified = false;
    }
    
    if (editProfileInput.password) {
        user.password = editProfileInput.password;
    }
    
    return this.users.save(user);
}
```

## QueryBuilder 사용

```typescript
// addSelect로 제외된 필드 추가
const user = await this.users
    .createQueryBuilder('user')
    .where('user.email = :email', { email })
    .addSelect('user.password')  // password 추가
    .getOne();
```

## Relations와 함께 사용

```typescript
@Entity()
export class Post {
    @Column()
    title: string;

    @Column({ select: false })
    draft: boolean;  // 초안 여부 (기본 제외)

    @ManyToOne(() => User)
    author: User;
}

// Relations 조회 시 select 옵션
const post = await posts.findOne({
    where: { id: 1 },
    relations: ['author'],
    select: ['id', 'title', 'draft']  // draft 포함
});
```

## select: false와 생명주기 훅

`select: false`로 설정된 필드가 **조회되지 않으면** 생명주기 훅에서 문제가 발생할 수 있습니다.

### 문제 상황

```typescript
@Entity()
export class User {
    @Column({ select: false })
    password: string;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
        // password가 조회되지 않으면 이 훅이 실행되어도
        // password가 undefined이므로 처리 필요
        if (this.password) {
            this.password = await bcrypt.hash(this.password, 10);
        }
    }
}
```

### 해결 방법 1: password 존재 여부 체크

```typescript
@BeforeInsert()
@BeforeUpdate()
async hashPassword() {
    // password가 있고, 아직 해싱되지 않았을 때만 해싱
    if (this.password && !this.password.startsWith('$2')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
}
```

### 해결 방법 2: update() 메서드 사용

```typescript
// Entity 생명주기 훅을 우회
async verifyEmail(userId: number) {
    await this.users.update(
        { id: userId },
        { verified: true }
    );
    // @BeforeUpdate가 실행되지 않으므로 password 이슈 없음
}
```

## 장단점

### ✅ 장점

1. **보안 강화**: 민감한 정보를 기본적으로 제외
   ```typescript
   @Column({ select: false })
   password: string;
   ```

2. **성능 향상**: 불필요한 데이터 조회 방지
   ```typescript
   @Column({ select: false })
   largeTextField: string;  // 큰 텍스트 필드 제외
   ```

3. **의도 명확화**: 어떤 필드가 민감한지 코드로 표현
   ```typescript
   @Column({ select: false })
   @Field(() => String)
   secretToken: string;
   ```

### ❌ 단점

1. **명시적 select 필요**: 필드가 필요할 때마다 지정해야 함
   ```typescript
   select: ['id', 'email', 'password', 'name', 'role', 'verified']
   ```

2. **생명주기 훅 주의**: undefined 처리 필요
   ```typescript
   if (this.password) {
       // password가 있을 때만 처리
   }
   ```

3. **Relations 복잡도**: 연관 엔티티의 select 필드도 고려

## 실전 패턴

### 패턴 1: 민감 정보 보호

```typescript
@Entity()
export class User {
    @Column({ select: false })
    password: string;
    
    @Column({ select: false })
    refreshToken: string;
    
    @Column({ select: false })
    resetPasswordToken: string;
}
```

### 패턴 2: 큰 데이터 최적화

```typescript
@Entity()
export class Article {
    @Column()
    title: string;
    
    @Column({ select: false })  // 내용은 상세 조회 시에만
    content: string;
    
    @Column()
    summary: string;  // 목록에서는 요약만
}
```

### 패턴 3: 소프트 삭제

```typescript
@Entity()
export class Post {
    @Column()
    title: string;
    
    @Column({ select: false })  // 삭제 여부는 관리자만
    deleted: boolean;
    
    @Column({ select: false })
    deletedAt: Date;
}
```

## 헬퍼 함수 만들기

```typescript
// user.entity.ts
export class User extends CoreEntity {
    @Column({ select: false })
    password: string;
    
    // 헬퍼 메서드
    static withPassword() {
        return ['id', 'email', 'password', 'role', 'verified'] as const;
    }
}

// users.service.ts
async login(email: string) {
    const user = await this.users.findOne({
        where: { email },
        select: User.withPassword()  // 깔끔!
    });
}
```

## 정리

| 시나리오 | select: false 사용 | 일반 필드 |
|---------|-------------------|----------|
| 민감한 정보 (password) | ✅ 권장 | ❌ |
| 큰 데이터 (content) | ✅ 성능 향상 | 상황에 따라 |
| 일반 정보 (email, name) | ❌ | ✅ |
| 자주 사용하는 필드 | ❌ 번거로움 | ✅ |

## 참고

- [TypeORM Entity - Column Options](https://typeorm.io/entities#column-options)
- 관련 문서: [cascade.md](./cascade.md), [entity-lifecycle.md](./entity-lifecycle.md)

