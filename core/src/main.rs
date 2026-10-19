use qun_core::{Chain, Transaction};

fn main() {
    let mut chain = Chain::new();
    chain.append(1, vec![Transaction {
        from: "alice-demo".to_owned(),
        to: "bob-demo".to_owned(),
        amount: 25,
        nonce: 1,
    }]);

    println!("QUN Core local prototype");
    println!("Blocks: {}", chain.blocks.len());
    for block in &chain.blocks {
        println!("block={} txs={} hash={} prev={}", block.index, block.transactions.len(), block.hash, block.previous_hash);
    }
    match chain.validate() {
        Ok(()) => println!("Chain integrity: OK"),
        Err(error) => {
            eprintln!("Chain integrity: FAILED: {error:?}");
            std::process::exit(1);
        }
    }
}
