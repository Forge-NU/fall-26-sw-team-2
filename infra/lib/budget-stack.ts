import { Stack, StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface BudgetStackProps extends StackProps {
  readonly email: string;
  readonly monthlyLimitUsd: number;
}

// Emails when the month's actual spend passes 80% of the limit, or the forecast
// passes 100%. Only in the app when -c yuji:budgetEmail=... is given, so the
// address isn't committed.
export class BudgetStack extends Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    const subscribers = [{ subscriptionType: 'EMAIL', address: props.email }];
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'yuji-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyLimitUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
      ],
    });
  }
}
