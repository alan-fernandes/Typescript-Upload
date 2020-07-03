import { getCustomRepository, getRepository, In, PromiseUtils } from 'typeorm';

import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import uploadConfig from '../config/upload';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CsvTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute(importFile: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const transactions: CsvTransaction[] = [];
    const categories: string[] = [];
    const filePath = path.join(uploadConfig.directory, importFile);
    const parseCSV = fs
      .createReadStream(filePath)
      .pipe(csv())
      .on('data', async data => {
        const { title, type, value, category } = data;
        if (!title || !type || !value) return;
        transactions.push({ title, type, value, category });
        categories.push(category);
      });

    await new Promise(resolve => parseCSV.on('end', resolve));
    const existentCategory = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });
    const existentCategoriesTitles = existentCategory.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );
    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategory];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => {
        const newTransaction = {
          title: transaction.title,
          type: transaction.type,
          value: transaction.value,
          category: finalCategories.find(
            category => category.title === transaction.category,
          ),
        };
        return newTransaction;
      }),
    );
    await transactionsRepository.save(createdTransactions);
    await fs.promises.unlink(filePath);
    return createdTransactions;
  }
}

export default ImportTransactionsService;
