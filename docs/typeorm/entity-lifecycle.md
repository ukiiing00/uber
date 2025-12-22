# TypeORM Entity 생명주기 훅

## 개요

TypeORM은 엔티티의 생명주기 동안 특정 시점에 실행되는 훅(Hook)을 제공합니다. 이를 통해 데이터 저장 전후에 로직을 실행할 수 있습니다.

## 생명주기 훅 종류

| 훅 | 실행 시점 | 설명 |
|---|---------|------|
| `@BeforeInsert()` | INSERT 전 | 새 엔티티 저장 전 |
| `@AfterInsert()` | INSERT 후 | 새 엔티티 저장 후 |
| `@BeforeUpdate()` | UPDATE 전 | 기존 엔티티 수정 전 |
| `@AfterUpdate()` | UPDATE 후 | 기존 엔티티 수정 후 |
| `@BeforeRemove()` | DELETE 전 | 엔티티 삭제 전 |
| `@AfterRemove()` | DELETE 후 | 엔티티 삭제 후 |
| `@AfterLoad()` | 조회 후 | 데이터베이스에서 로드 후 |

## INSERT vs UPDATE 판단

TypeORM은 엔티티에 **id(PK)가 있는지**로 INSERT/UPDATE를 판단합니다.

```typescript
// INSERT - id가 없음
const user = users.create({ email: 'test@test.com' });
await users.save(user);  // @BeforeInsert 실행

// UPDATE - id가 있음
const user = await users.findOne({ where: { id: 1 } });
user.email = 'new@test.com';
await users.save(user);  // @BeforeUpdate 실행
```

## 기본 사용법

### @BeforeInsert

```typescript
@Entity()
export class User {
    @Column()
    email: string;

    @Column()
    createdAt: Date;

    @BeforeInsert()
    setCreatedAt() {
        this.createdAt = new Date();
    }
}
```

### @BeforeUpdate

```typescript
@Entity()
export class Post {
    @Column()
    title: string;

    @Column()
    updatedAt: Date;

    @BeforeUpdate()
    setUpdatedAt() {
        this.updatedAt = new Date();
    }
}
```

### @BeforeInsert + @BeforeUpdate

```typescript
@Entity()
export class User {
    @Column()
    password: string;

    // INSERT와 UPDATE 모두에서 실행
    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
        this.password = await bcrypt.hash(this.password, 10);
    }
}
```

## 실전 예시

### Password 해싱

```typescript
@Entity()
export class User extends CoreEntity {
    @Column()
    email: string;

    @Column({ select: false })
    password: string;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword(): Promise<void> {
        // password가 있고, 아직 해싱되지 않았을 때만
        if (this.password && !this.password.startsWith('$2')) {
            this.password = await bcrypt.hash(this.password, 10);
        }
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
```

### UUID 코드 생성

```typescript
import { v4 as uuidv4 } from 'uuid';

@Entity()
export class Verification extends CoreEntity {
    @Column()
    code: string;

    @OneToOne(() => User)
    @JoinColumn()
    user: User;

    @BeforeInsert()
    createCode(): void {
        this.code = uuidv4();
    }
}

// 사용
const verification = verifications.create({ user });
await verifications.save(verification);
// @BeforeInsert 실행 → code 자동 생성
```

### Slug 생성

```typescript
@Entity()
export class Article {
    @Column()
    title: string;

    @Column({ unique: true })
    slug: string;

    @BeforeInsert()
    generateSlug() {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
}
```

### 소프트 삭제

```typescript
@Entity()
export class Post {
    @Column()
    title: string;

    @Column({ default: false })
    deleted: boolean;

    @Column({ nullable: true })
    deletedAt: Date;

    @BeforeRemove()
    softDelete() {
        this.deleted = true;
        this.deletedAt = new Date();
    }
}
```

## 훅이 실행되는 경우

### ✅ 실행됨

```typescript
// save() 메서드
const user = users.create({ email, password });
await users.save(user);  // ✅ @BeforeInsert 실행

const user = await users.findOne({ where: { id: 1 } });
user.email = 'new@test.com';
await users.save(user);  // ✅ @BeforeUpdate 실행

// remove() 메서드
await users.remove(user);  // ✅ @BeforeRemove 실행

// Cascade를 통한 저장
verification.user.verified = true;
await verifications.save(verification);  // cascade: true
// ✅ User의 @BeforeUpdate 실행됨
```

### ❌ 실행 안 됨

```typescript
// update() 메서드 (Query Builder)
await users.update({ id: 1 }, { email: 'new@test.com' });
// ❌ @BeforeUpdate 실행 안 됨

// delete() 메서드
await users.delete({ id: 1 });
// ❌ @BeforeRemove 실행 안 됨

// createQueryBuilder
await users
    .createQueryBuilder()
    .update(User)
    .set({ email: 'new@test.com' })
    .where('id = :id', { id: 1 })
    .execute();
// ❌ @BeforeUpdate 실행 안 됨
```

## 주의사항

### 1. 이중 해싱 문제

```typescript
// 문제: password가 이미 해싱되어 있어도 다시 해싱됨
@BeforeInsert()
@BeforeUpdate()
async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
    // ⚠️ 이미 해싱된 password를 또 해싱!
}

// 해결: 해싱 여부 체크
@BeforeInsert()
@BeforeUpdate()
async hashPassword() {
    if (this.password && !this.password.startsWith('$2')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
}
```

### 2. select: false와 함께 사용

```typescript
@Entity()
export class User {
    @Column({ select: false })
    password: string;

    @BeforeUpdate()
    async hashPassword() {
        // password가 조회되지 않으면 undefined
        if (this.password) {  // 체크 필수!
            this.password = await bcrypt.hash(this.password, 10);
        }
    }
}

// 사용 시
const user = await users.findOne({ where: { id: 1 } });
// password는 undefined

user.verified = true;
await users.save(user);
// @BeforeUpdate 실행되지만 password는 undefined이므로 안전
```

### 3. 비동기 작업

```typescript
@BeforeInsert()
async generateThumbnail() {
    // 비동기 작업 가능
    this.thumbnail = await imageService.createThumbnail(this.image);
}
```

## save() vs update() 선택 기준

### save() 사용 (훅 실행 O)

```typescript
// 장점: 생명주기 훅 실행, 검증 실행
// 단점: Entity를 메모리에 로드해야 함

async editProfile(userId: number, input: EditProfileInput) {
    const user = await users.findOne({ where: { id: userId } });
    
    if (input.password) {
        user.password = input.password;
        // @BeforeUpdate에서 자동 해싱됨
    }
    
    return users.save(user);
}
```

### update() 사용 (훅 실행 X)

```typescript
// 장점: 빠름, Entity 로드 불필요
// 단점: 생명주기 훅 실행 안 됨

async verifyEmail(userId: number) {
    // verified만 변경하면 되므로 훅 불필요
    await users.update(
        { id: userId },
        { verified: true }
    );
}
```

## 실전 패턴

### 패턴 1: 타임스탬프 자동 관리

```typescript
@Entity()
export abstract class CoreEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @BeforeInsert()
    setCreatedAt() {
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    @BeforeUpdate()
    setUpdatedAt() {
        this.updatedAt = new Date();
    }
}
```

### 패턴 2: 데이터 정규화

```typescript
@Entity()
export class User {
    @Column()
    email: string;

    @BeforeInsert()
    @BeforeUpdate()
    normalizeEmail() {
        this.email = this.email.toLowerCase().trim();
    }
}
```

### 패턴 3: 연관 데이터 자동 생성

```typescript
@Entity()
export class User {
    @Column()
    email: string;

    @AfterInsert()
    async createProfile() {
        // User 생성 후 자동으로 Profile 생성
        const profile = new Profile();
        profile.user = this;
        await profile.save();
    }
}
```

### 패턴 4: 감사 로그

```typescript
@Entity()
export class Article {
    @Column()
    title: string;

    @AfterInsert()
    logCreation() {
        console.log(`Article created: ${this.title}`);
    }

    @AfterUpdate()
    logUpdate() {
        console.log(`Article updated: ${this.title}`);
    }
}
```

## 정리

| 메서드 | 훅 실행 | 성능 | 사용 케이스 |
|--------|--------|------|-----------|
| `save()` | ✅ | 느림 | 복잡한 로직, 검증 필요 |
| `update()` | ❌ | 빠름 | 간단한 업데이트 |
| `remove()` | ✅ | 느림 | 삭제 전 로직 필요 |
| `delete()` | ❌ | 빠름 | 단순 삭제 |

## 참고

- [TypeORM Listeners and Subscribers](https://typeorm.io/listeners-and-subscribers)
- 관련 문서: [cascade.md](./cascade.md), [select.md](./select.md)

