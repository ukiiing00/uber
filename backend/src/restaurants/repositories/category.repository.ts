import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectRepository(Category)
    private readonly repository: Repository<Category>,
  ) {}

  async getOrCreate(name: string): Promise<Category> {
    const categoryName = name.trim().toLowerCase();
    const categorySlug = categoryName.replace(/ /g, '-');
    let category = await this.repository.findOne({
      where: { slug: categorySlug },
    });
    if (!category) {
      category = this.repository.create({
        name: categoryName,
        slug: categorySlug,
      });
      await this.repository.save(category);
    }
    return category;
  }
}
