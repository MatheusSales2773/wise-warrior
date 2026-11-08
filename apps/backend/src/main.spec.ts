import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

jest.mock('@nestjs/core', () => ({ ...jest.requireActual('@nestjs/core'), NestFactory: { create: jest.fn() } }));

/** O webhook do Stripe só verifica a assinatura sobre o corpo bruto, então o bootstrap real precisa guardá-lo (ADR-015). */
describe('main bootstrap', () => {
  it('creates the application with rawBody enabled', async () => {
    const create = NestFactory.create as jest.Mock;
    create.mockRejectedValue(new Error('stop after create'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const previousExitCode = process.exitCode;

    await import('./main');
    await new Promise(setImmediate);

    expect(create).toHaveBeenCalledWith(AppModule, expect.objectContaining({ rawBody: true }));
    consoleError.mockRestore();
    process.exitCode = previousExitCode;
  });
});
