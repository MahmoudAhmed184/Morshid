UPDATE universities AS university
SET status = 'INACTIVE'::university_status
FROM university_subscriptions AS subscription
WHERE subscription.university_id = university.id
  AND subscription.status = 'CANCELLED'::subscription_status
  AND university.status <> 'INACTIVE'::university_status;
