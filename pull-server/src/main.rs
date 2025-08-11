use std::process::Command;
use actix_web::{get, Responder, App, HttpResponse, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(index))
        .bind(("127.0.0.1", 10000))?
        .run()
        .await
}

#[get("/")]
async fn index() -> impl Responder {
    let output = Command::new("git")
        .arg("pull")
        .output()
        .expect("Failed to execute command");

    if output.status.success() && !String::from_utf8_lossy(&output.stdout).contains("Already up to date.") {
        HttpResponse::Ok().body(format!("Changes applied: {}", String::from_utf8_lossy(&output.stdout).trim()))
    } else if String::from_utf8_lossy(&output.stdout).contains("Already up to date.") {
        HttpResponse::NoContent().body("No changes to apply")
    } else {
        HttpResponse::InternalServerError().body(format!("Error applying changes: {}", String::from_utf8_lossy(&output.stderr).trim()))
    }
}
