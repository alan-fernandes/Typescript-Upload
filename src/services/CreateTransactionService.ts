import AppError from '../errors/AppError';
import { getCustomRepository, getRepository } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';
import { request } from 'express';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionRepository);

    const categoryRepository = getRepository(Category);

    let categoryTransaction = await categoryRepository.findOne({
      where: { title: category },
    });
    if (!categoryTransaction) {
      categoryTransaction = categoryRepository.create({
        title: category,
      });
      await categoryRepository.save(categoryTransaction);
    }

    if (type === 'outcome') {
      const checkBalance = await transactionRepository.getBalance();
      if (value > checkBalance.total) {
        throw new AppError('you dont have balance to outcome', 400);
      }
    }
    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category_id: categoryTransaction.id,
    });
    await transactionRepository.save(transaction);
    return transaction;
  }
}

export default CreateTransactionService;
