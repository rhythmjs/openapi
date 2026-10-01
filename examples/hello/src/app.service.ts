export const appService = {
  getHello(): string {
    return "Hello World!";
  },
  greet(name: string): string {
    return `Hello, ${name}!`;
  },
};
