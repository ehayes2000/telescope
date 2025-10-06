pub const PORT: u32 = 5050;
pub const WS_PORT: u32 = 5055;

pub struct BucketConfig {
    pub token_value: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub s3_endpoint: String,
    pub bucket_name: String,
}

impl BucketConfig {
    pub fn from_env() -> Self {
        BucketConfig {
            token_value: std::env::var("R2_TOKEN_VALUE").expect("R2_TOKEN_VALUE"),
            access_key_id: std::env::var("R2_ACCESS_KEY_ID").expect("R2_ACCESS_KEY_ID"),
            secret_access_key: std::env::var("R2_SECRET_ACCESS_KEY").expect("R2_SECRET_ACCESS_KEY"),
            s3_endpoint: std::env::var("R2_S3_ENDPOINT").expect("R2_S3_ENDPOINT"),
            bucket_name: std::env::var("R2_BUCKET_NAME").expect("R2_BUCKET_NAME"),
        }
    }
}
